#!/bin/bash

# AI Planner API Database Migration Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MIGRATION_TYPE="up"
TARGET_VERSION=""
DRY_RUN=false
FORCE=false
ENVIRONMENT="development"

# Function to print colored output
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to print error and exit
error_exit() {
    print_message $RED "ERROR: $1" >&2
    exit 1
}

# Function to display help
display_help() {
    echo "AI Planner API Migration Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -t, --type TYPE         Migration type (up|down|rollback|status)"
    echo "  -v, --version VERSION   Target version for migration"
    echo "  -e, --environment ENV   Environment (default: development)"
    echo "  -d, --dry-run          Show what would be migrated without migrating"
    echo "  -f, --force            Force migration without confirmation"
    echo "  -h, --help             Display this help message"
    echo
    echo "Examples:"
    echo "  $0                     # Run pending migrations"
    echo "  $0 -t rollback -v 1    # Rollback to version 1"
    echo "  $0 -t status           # Show migration status"
}

# Function to check prerequisites
check_prerequisites() {
    print_message $BLUE "Checking prerequisites..."
    
    # Check if Node.js is available
    if ! command_exists node; then
        error_exit "Node.js is not installed"
    fi
    
    # Check if Firebase is configured
    if [ -z "${FIREBASE_PROJECT_ID}" ]; then
        error_exit "Firebase is not configured"
    fi
    
    print_message $GREEN "Prerequisites check passed!"
}

# Function to get current migration version
get_current_version() {
    # This would query your database to get the current migration version
    # For now, we'll simulate it
    local current_version=$(node -e "
        const admin = require('firebase-admin');
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n')
        };
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        
        const db = admin.firestore();
        db.collection('_migrations').doc('current').get()
            .then(doc => {
                const version = doc.exists ? doc.data().version : 0;
                console.log(version);
                process.exit(0);
            })
            .catch(err => {
                console.error(err);
                process.exit(1);
            });
    " 2>/dev/null || echo "0")
    
    echo "${current_version}"
}

# Function to get available migrations
get_available_migrations() {
    local migrations_dir="migrations"
    if [ -d "${migrations_dir}" ]; then
        ls -1 ${migrations_dir}/*.js 2>/dev/null | sort -V || true
    else
        echo ""
    fi
}

# Function to run migration
run_migration() {
    local migration_file=$1
    local direction=$2
    
    print_message $BLUE "Running migration: $(basename ${migration_file}) ${direction}"
    
    if [ "$DRY_RUN" = true ]; then
        print_message $YELLOW "DRY RUN: Would execute ${migration_file} ${direction}"
        return 0
    fi
    
    node -e "
        const migration = require('./${migration_file}');
        const admin = require('firebase-admin');
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n')
        };
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        
        const db = admin.firestore();
        const direction = '${direction}';
        
        async function run() {
            try {
                if (direction === 'up' && migration.up) {
                    await migration.up(db, admin);
                    console.log('Migration completed successfully');
                } else if (direction === 'down' && migration.down) {
                    await migration.down(db, admin);
                    console.log('Rollback completed successfully');
                } else {
                    console.log('No migration function found for direction:', direction);
                }
                process.exit(0);
            } catch (error) {
                console.error('Migration failed:', error);
                process.exit(1);
            }
        }
        
        run();
    "
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "Migration completed: $(basename ${migration_file})"
        return 0
    else
        print_message $RED "Migration failed: $(basename ${migration_file})"
        return 1
    fi
}

# Function to update migration version
update_migration_version() {
    local version=$1
    local description=$2
    
    if [ "$DRY_RUN" = true ]; then
        print_message $YELLOW "DRY RUN: Would update migration version to ${version}"
        return 0
    fi
    
    node -e "
        const admin = require('firebase-admin');
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\\\n/g, '\\n')
        };
        
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
        }
        
        const db = admin.firestore();
        
        async function updateVersion() {
            try {
                await db.collection('_migrations').doc('current').set({
                    version: ${version},
                    description: '${description}',
                    migratedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                console.log('Migration version updated to ${version}');
                process.exit(0);
            } catch (error) {
                console.error('Failed to update migration version:', error);
                process.exit(1);
            }
        }
        
        updateVersion();
    "
}

# Function to run up migrations
run_up_migrations() {
    print_message $BLUE "Running up migrations..."
    
    local current_version=$(get_current_version)
    local available_migrations=($(get_available_migrations))
    local migrations_run=0
    
    print_message $NC "Current version: ${current_version}"
    
    for migration_file in "${available_migrations[@]}"; do
        local migration_version=$(basename ${migration_file} | cut -d'_' -f1)
        
        if [ ${migration_version} -gt ${current_version} ]; then
            print_message $BLUE "Migrating to version ${migration_version}..."
            
            if run_migration "${migration_file}" "up"; then
                update_migration_version ${migration_version} "Migration to version ${migration_version}"
                migrations_run=$((migrations_run + 1))
            else
                error_exit "Migration to version ${migration_version} failed"
            fi
        fi
    done
    
    if [ ${migrations_run} -eq 0 ]; then
        print_message $GREEN "No pending migrations"
    else
        print_message $GREEN "${migrations_run} migrations completed successfully"
    fi
}

# Function to run down migrations
run_down_migrations() {
    local target_version=${1:-0}
    local current_version=$(get_current_version)
    
    print_message $BLUE "Rolling back to version ${target_version}..."
    print_message $NC "Current version: ${current_version}"
    
    if [ ${current_version} -le ${target_version} ]; then
        print_message $YELLOW "Already at or below target version"
        return 0
    fi
    
    local available_migrations=($(get_available_migrations))
    local migrations_run=0
    
    # Sort migrations in reverse order
    local reversed_migrations=($(printf '%s\n' "${available_migrations[@]}" | sort -rV))
    
    for migration_file in "${reversed_migrations[@]}"; do
        local migration_version=$(basename ${migration_file} | cut -d'_' -f1)
        
        if [ ${migration_version} -gt ${target_version} ] && [ ${migration_version} -le ${current_version} ]; then
            print_message $BLUE "Rolling back version ${migration_version}..."
            
            if run_migration "${migration_file}" "down"; then
                update_migration_version $((migration_version - 1)) "Rollback from version ${migration_version}"
                migrations_run=$((migrations_run + 1))
            else
                error_exit "Rollback from version ${migration_version} failed"
            fi
        fi
    done
    
    print_message $GREEN "${migrations_run} rollbacks completed successfully"
}

# Function to show migration status
show_status() {
    print_message $BLUE "Migration Status"
    echo "================"
    
    local current_version=$(get_current_version)
    local available_migrations=($(get_available_migrations))
    
    print_message $NC "Current version: ${current_version}"
    print_message $NC "Available migrations:"
    
    for migration_file in "${available_migrations[@]}"; do
        local migration_version=$(basename ${migration_file} | cut -d'_' -f1)
        local migration_name=$(basename ${migration_file} | sed 's/^[0-9]*_//' | sed 's/\.js$//')
        
        if [ ${migration_version} -le ${current_version} ]; then
            print_message $GREEN "  ✓ ${migration_version}: ${migration_name} (applied)"
        else
            print_message $YELLOW "  ○ ${migration_version}: ${migration_name} (pending)"
        fi
    done
}

# Function to create new migration
create_migration() {
    local migration_name=$1
    local timestamp=$(date +%Y%m%d%H%M%S)
    local migration_file="migrations/${timestamp}_${migration_name}.js"
    
    print_message $BLUE "Creating new migration: ${migration_file}"
    
    mkdir -p migrations
    
    cat > "${migration_file}" << 'EOF'
/**
 * Migration: ${migration_name}
 * Created: $(date)
 */

const migration = {
  /**
   * Up migration
   * @param {FirebaseFirestore.Firestore} db - Firestore instance
   * @param {admin} admin - Firebase Admin instance
   */
  async up(db, admin) {
    // Add your up migration logic here
    console.log('Running up migration: ${migration_name}');
    
    // Example: Create a new collection
    // await db.collection('newCollection').doc('example').set({
    //   createdAt: admin.firestore.FieldValue.serverTimestamp()
    // });
    
    // Example: Update existing documents
    // const snapshot = await db.collection('users').get();
    // const batch = db.batch();
    // 
    // snapshot.docs.forEach(doc => {
    //   batch.update(doc.ref, {
    //     updatedAt: admin.firestore.FieldValue.serverTimestamp()
    //   });
    // });
    // 
    // await batch.commit();
  },

  /**
   * Down migration (rollback)
   * @param {FirebaseFirestore.Firestore} db - Firestore instance
   * @param {admin} admin - Firebase Admin instance
   */
  async down(db, admin) {
    // Add your down migration logic here
    console.log('Running down migration: ${migration_name}');
    
    // Example: Remove collection
    // const snapshot = await db.collection('newCollection').get();
    // const batch = db.batch();
    // 
    // snapshot.docs.forEach(doc => {
    //   batch.delete(doc.ref);
    // });
    // 
    // await batch.commit();
  }
};

module.exports = migration;
EOF
    
    print_message $GREEN "Migration created: ${migration_file}"
}

# Function to validate environment
validate_environment() {
    # Load environment variables
    if [ -f ".env.${ENVIRONMENT}" ]; then
        export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
    fi
    
    # Check required variables
    local required_vars=("FIREBASE_PROJECT_ID" "FIREBASE_CLIENT_EMAIL" "FIREBASE_PRIVATE_KEY")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error_exit "Required environment variable ${var} is not set"
        fi
    done
}

# Main migration function
main() {
    print_message $BLUE "=== AI Planner API Migration ==="
    print_message $NC "Environment: $ENVIRONMENT"
    print_message $NC "Migration Type: $MIGRATION_TYPE"
    print_message $NC "Target Version: ${TARGET_VERSION:-N/A}"
    echo

    # Validate environment
    validate_environment

    # Check prerequisites
    check_prerequisites

    # Confirmation
    if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ] && [ "$MIGRATION_TYPE" != "status" ]; then
        print_message $YELLOW "Are you sure you want to run ${MIGRATION_TYPE} migration? (yes/no)"
        read -r response
        if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
            print_message $YELLOW "Migration cancelled."
            exit 0
        fi
    fi

    # Execute migration based on type
    case ${MIGRATION_TYPE} in
        up)
            run_up_migrations
            ;;
        down)
            run_down_migrations 0
            ;;
        rollback)
            if [ -z "${TARGET_VERSION}" ]; then
                error_exit "Target version required for rollback"
            fi
            run_down_migrations ${TARGET_VERSION}
            ;;
        status)
            show_status
            ;;
        create)
            if [ -z "${TARGET_VERSION}" ]; then
                error_exit "Migration name required for create"
            fi
            create_migration ${TARGET_VERSION}
            ;;
        *)
            error_exit "Unknown migration type: ${MIGRATION_TYPE}"
            ;;
    esac

    print_message $GREEN "\n✅ Migration completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            MIGRATION_TYPE="$2"
            shift 2
            ;;
        -v|--version)
            TARGET_VERSION="$2"
            shift 2
            ;;
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            display_help
            exit 0
            ;;
        *)
            error_exit "Unknown option: $1"
            ;;
    esac
done

# Run main function
main "$@"
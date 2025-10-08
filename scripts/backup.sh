#!/bin/bash

# AI Planner API Backup Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BACKUP_TYPE="full"
COMPRESSION="gzip"
RETENTION_DAYS=30
S3_BUCKET=""
ENVIRONMENT="production"
DRY_RUN=false

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
    echo "AI Planner API Backup Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -t, --type TYPE         Backup type (full|database|config|logs)"
    echo "  -c, --compression TYPE  Compression type (gzip|bzip2|xz|none)"
    echo "  -r, --retention DAYS    Retention period in days (default: 30)"
    echo "  -s, --s3-bucket BUCKET  S3 bucket for backup upload"
    echo "  -e, --environment ENV   Environment (default: production)"
    echo "  -d, --dry-run          Show what would be backed up without backing up"
    echo "  -h, --help             Display this help message"
    echo
    echo "Examples:"
    echo "  $0                              # Full backup with default settings"
    echo "  $0 -t database -s my-bucket    # Database backup to S3"
    echo "  $0 -t config -c none -d        # Dry run config backup without compression"
}

# Function to create backup directory
create_backup_dir() {
    local timestamp=$(date +%Y%m%d-%H%M%S)
    BACKUP_DIR="backups/${timestamp}"
    mkdir -p "${BACKUP_DIR}"
    print_message $GREEN "Created backup directory: ${BACKUP_DIR}"
}

# Function to backup Firebase database
backup_firebase() {
    print_message $BLUE "Backing up Firebase database..."
    
    local firebase_backup_dir="${BACKUP_DIR}/firebase"
    mkdir -p "${firebase_backup_dir}"
    
    # Export users
    if command_exists firebase; then
        firebase auth:export "${firebase_backup_dir}/users.json" --format=JSON
        print_message $GREEN "Firebase users exported"
    else
        print_message $YELLOW "Firebase CLI not found. Skipping user export."
    fi
    
    # Export Firestore data (if you have a custom export script)
    if [ -f "scripts/firebase-export.sh" ]; then
        bash scripts/firebase-export.sh "${firebase_backup_dir}"
        print_message $GREEN "Firebase Firestore data exported"
    else
        print_message $YELLOW "Firebase export script not found. Skipping Firestore export."
    fi
}

# Function to backup Redis data
backup_redis() {
    print_message $BLUE "Backing up Redis data..."
    
    local redis_backup_dir="${BACKUP_DIR}/redis"
    mkdir -p "${redis_backup_dir}"
    
    # Create Redis backup
    if command_exists redis-cli; then
        redis-cli BGSAVE
        sleep 5  # Wait for background save to complete
        
        # Find Redis dump file
        local redis_dir=$(redis-cli CONFIG GET dir | tail -n 1)
        local dump_file="${redis_dir}/dump.rdb"
        
        if [ -f "${dump_file}" ]; then
            cp "${dump_file}" "${redis_backup_dir}/dump.rdb"
            print_message $GREEN "Redis data backed up"
        else
            print_message $YELLOW "Redis dump file not found"
        fi
    else
        print_message $YELLOW "Redis CLI not found. Skipping Redis backup."
    fi
}

# Function to backup application files
backup_application() {
    print_message $BLUE "Backing up application files..."
    
    local app_backup_dir="${BACKUP_DIR}/application"
    mkdir -p "${app_backup_dir}"
    
    # Backup source code (if git is available)
    if [ -d ".git" ]; then
        git bundle create "${app_backup_dir}/source.bundle" --all
        print_message $GREEN "Source code backed up (git bundle)"
    else
        # Backup source files directly
        tar -czf "${app_backup_dir}/source.tar.gz" \
            --exclude='node_modules' \
            --exclude='dist' \
            --exclude='logs' \
            --exclude='.git' \
            --exclude='backups' \
            .
        print_message $GREEN "Source code backed up (tar archive)"
    fi
    
    # Backup compiled application
    if [ -d "dist" ]; then
        tar -czf "${app_backup_dir}/dist.tar.gz" dist
        print_message $GREEN "Compiled application backed up"
    fi
    
    # Backup configuration files
    if [ -d "config" ]; then
        cp -r config "${app_backup_dir}/"
        print_message $GREEN "Configuration files backed up"
    fi
    
    # Backup environment files
    find . -name ".env.*" -type f -exec cp {} "${app_backup_dir}/" \;
    print_message $GREEN "Environment files backed up"
}

# Function to backup logs
backup_logs() {
    print_message $BLUE "Backing up logs..."
    
    local logs_backup_dir="${BACKUP_DIR}/logs"
    mkdir -p "${logs_backup_dir}"
    
    # Backup application logs
    if [ -d "logs" ]; then
        cp -r logs/* "${logs_backup_dir}/" 2>/dev/null || true
        print_message $GREEN "Application logs backed up"
    fi
    
    # Backup PM2 logs (if PM2 is used)
    if command_exists pm2; then
        pm2 logs --lines 1000 > "${logs_backup_dir}/pm2.log"
        print_message $GREEN "PM2 logs backed up"
    fi
    
    # Backup system logs (if accessible)
    if [ -d "/var/log" ] && [ "$(uname)" = "Linux" ]; then
        cp /var/log/syslog "${logs_backup_dir}/" 2>/dev/null || true
        cp /var/log/auth.log "${logs_backup_dir}/" 2>/dev/null || true
        print_message $GREEN "System logs backed up"
    fi
}

# Function to backup SSL certificates
backup_ssl() {
    print_message $BLUE "Backing up SSL certificates..."
    
    local ssl_backup_dir="${BACKUP_DIR}/ssl"
    mkdir -p "${ssl_backup_dir}"
    
    # Backup nginx SSL certificates
    if [ -d "nginx/ssl" ]; then
        cp -r nginx/ssl/* "${ssl_backup_dir}/" 2>/dev/null || true
        print_message $GREEN "SSL certificates backed up"
    fi
}

# Function to create backup manifest
create_manifest() {
    print_message $BLUE "Creating backup manifest..."
    
    cat > "${BACKUP_DIR}/manifest.txt" << EOF
AI Planner API Backup
=====================
Backup Date: $(date)
Backup Type: ${BACKUP_TYPE}
Environment: ${ENVIRONMENT}
Hostname: $(hostname)
User: $(whoami)
Git Commit: $(git rev-parse HEAD 2>/dev/null || echo "Unknown")
Git Branch: $(git branch --show-current 2>/dev/null || echo "Unknown")
Git Status: $(git status --porcelain 2>/dev/null | wc -l) files modified

System Information:
- OS: $(uname -s)
- Kernel: $(uname -r)
- Architecture: $(uname -m)
- Uptime: $(uptime)

Backup Contents:
$(find "${BACKUP_DIR}" -type f -exec ls -lh {} \; | awk '{print "- " $9 ": " $5}')

Backup Size: $(du -sh "${BACKUP_DIR}" | cut -f1)
EOF
    
    print_message $GREEN "Backup manifest created"
}

# Function to compress backup
compress_backup() {
    if [ "${COMPRESSION}" = "none" ]; then
        print_message $YELLOW "Skipping compression"
        return
    fi
    
    print_message $BLUE "Compressing backup..."
    
    local compressed_file="${BACKUP_DIR}.tar"
    
    # Create tar archive
    tar -cf "${compressed_file}" "${BACKUP_DIR}"
    
    # Compress based on selected method
    case ${COMPRESSION} in
        gzip)
            gzip "${compressed_file}"
            compressed_file="${compressed_file}.gz"
            ;;
        bzip2)
            bzip2 "${compressed_file}"
            compressed_file="${compressed_file}.bz2"
            ;;
        xz)
            xz "${compressed_file}"
            compressed_file="${compressed_file}.xz"
            ;;
    esac
    
    # Remove uncompressed backup directory
    rm -rf "${BACKUP_DIR}"
    
    print_message $GREEN "Backup compressed: ${compressed_file}"
    print_message $NC "Compression ratio: $(du -sh "${compressed_file}" | cut -f1)"
}

# Function to upload to S3
upload_to_s3() {
    if [ -z "${S3_BUCKET}" ]; then
        print_message $YELLOW "No S3 bucket specified. Skipping upload."
        return
    fi
    
    print_message $BLUE "Uploading to S3..."
    
    # Check if AWS CLI is installed
    if ! command_exists aws; then
        print_message $RED "AWS CLI not found. Cannot upload to S3."
        return
    fi
    
    local backup_file="${BACKUP_DIR}.tar"
    if [ "${COMPRESSION}" != "none" ]; then
        backup_file="${backup_file}.${COMPRESSION}"
    fi
    
    local s3_key="ai-planner-backups/${ENVIRONMENT}/$(basename ${backup_file})"
    
    # Upload to S3
    aws s3 cp "${backup_file}" "s3://${S3_BUCKET}/${s3_key}" \
        --storage-class STANDARD_IA \
        --metadata "environment=${ENVIRONMENT},backup-type=${BACKUP_TYPE}"
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "Backup uploaded to S3: s3://${S3_BUCKET}/${s3_key}"
        
        # Generate presigned URL (valid for 7 days)
        local presigned_url=$(aws s3 presign "s3://${S3_BUCKET}/${s3_key}" --expires-in 604800)
        print_message $NC "Presigned URL (valid for 7 days): ${presigned_url}"
    else
        print_message $RED "Failed to upload to S3"
    fi
}

# Function to cleanup old backups
cleanup_old_backups() {
    print_message $BLUE "Cleaning up old backups..."
    
    local deleted_count=0
    
    # Local cleanup
    if [ -d "backups" ]; then
        find backups -name "*.tar*" -type f -mtime +${RETENTION_DAYS} -delete -print | while read -r file; do
            print_message $YELLOW "Deleted old backup: $file"
            deleted_count=$((deleted_count + 1))
        done
    fi
    
    # S3 cleanup
    if [ -n "${S3_BUCKET}" ] && command_exists aws; then
        aws s3 ls "s3://${S3_BUCKET}/ai-planner-backups/${ENVIRONMENT}/" \
            --recursive \
            --query "Contents[?LastModified<='$(date -d "${RETENTION_DAYS} days ago" +%Y-%m-%d)'].Key" \
            --output text | while read -r key; do
            if [ -n "$key" ]; then
                aws s3 rm "s3://${S3_BUCKET}/${key}"
                print_message $YELLOW "Deleted old S3 backup: $key"
                deleted_count=$((deleted_count + 1))
            fi
        done
    fi
    
    if [ $deleted_count -eq 0 ]; then
        print_message $GREEN "No old backups to delete"
    else
        print_message $GREEN "Deleted $deleted_count old backups"
    fi
}

# Function to verify backup
verify_backup() {
    print_message $BLUE "Verifying backup..."
    
    local backup_file="${BACKUP_DIR}.tar"
    if [ "${COMPRESSION}" != "none" ]; then
        backup_file="${backup_file}.${COMPRESSION}"
    fi
    
    # Check if backup file exists
    if [ ! -f "${backup_file}" ]; then
        error_exit "Backup file not found: ${backup_file}"
    fi
    
    # Test archive integrity
    case ${COMPRESSION} in
        gzip)
            gunzip -t "${backup_file}" 2>/dev/null
            ;;
        bzip2)
            bzip2 -t "${backup_file}" 2>/dev/null
            ;;
        xz)
            xz -t "${backup_file}" 2>/dev/null
            ;;
        none)
            tar -tf "${backup_file}" >/dev/null 2>&1
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        print_message $GREEN "Backup verification successful"
    else
        error_exit "Backup verification failed"
    fi
}

# Function to encrypt backup
encrypt_backup() {
    if [ -z "${BACKUP_ENCRYPTION_KEY}" ]; then
        print_message $YELLOW "No encryption key provided. Skipping encryption."
        return
    fi
    
    print_message $BLUE "Encrypting backup..."
    
    local backup_file="${BACKUP_DIR}.tar"
    if [ "${COMPRESSION}" != "none" ]; then
        backup_file="${backup_file}.${COMPRESSION}"
    fi
    
    local encrypted_file="${backup_file}.enc"
    
    # Encrypt using OpenSSL
    openssl enc -aes-256-cbc -salt -in "${backup_file}" -out "${encrypted_file}" -pass pass:${BACKUP_ENCRYPTION_KEY}
    
    if [ $? -eq 0 ]; then
        rm "${backup_file}"
        print_message $GREEN "Backup encrypted: ${encrypted_file}"
    else
        error_exit "Backup encryption failed"
    fi
}

# Main backup function
main() {
    print_message $BLUE "=== AI Planner API Backup ==="
    print_message $NC "Backup Type: $BACKUP_TYPE"
    print_message $NC "Compression: $COMPRESSION"
    print_message $NC "Retention: $RETENTION_DAYS days"
    print_message $NC "Environment: $ENVIRONMENT"
    print_message $NC "S3 Bucket: ${S3_BUCKET:-Not specified}"
    echo

    # Confirmation
    if [ "$DRY_RUN" = false ]; then
        print_message $YELLOW "Are you sure you want to create a backup? (yes/no)"
        read -r response
        if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
            print_message $YELLOW "Backup cancelled."
            exit 0
        fi
    fi

    # Create backup directory
    create_backup_dir

    # Perform backup based on type
    case ${BACKUP_TYPE} in
        full)
            backup_firebase
            backup_redis
            backup_application
            backup_logs
            backup_ssl
            ;;
        database)
            backup_firebase
            backup_redis
            ;;
        config)
            backup_application
            backup_ssl
            ;;
        logs)
            backup_logs
            ;;
        *)
            error_exit "Unknown backup type: ${BACKUP_TYPE}"
            ;;
    esac

    # Create manifest
    create_manifest

    # Dry run
    if [ "$DRY_RUN" = true ]; then
        print_message $YELLOW "Dry run completed. Backup would be created at: ${BACKUP_DIR}"
        ls -la "${BACKUP_DIR}"
        exit 0
    fi

    # Compress backup
    compress_backup

    # Encrypt backup (if key provided)
    encrypt_backup

    # Verify backup
    verify_backup

    # Upload to S3 (if bucket specified)
    upload_to_s3

    # Cleanup old backups
    cleanup_old_backups

    print_message $GREEN "\n✅ Backup completed successfully!"
    print_message $NC "Backup location: ${BACKUP_DIR}.tar${COMPRESSION:+.$COMPRESSION}"
    print_message $NC "Backup size: $(du -sh ${BACKUP_DIR}.tar${COMPRESSION:+.$COMPRESSION} | cut -f1)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            BACKUP_TYPE="$2"
            shift 2
            ;;
        -c|--compression)
            COMPRESSION="$2"
            shift 2
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
            shift 2
            ;;
        -s|--s3-bucket)
            S3_BUCKET="$2"
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
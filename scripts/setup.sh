#!/bin/bash

# AI Planner API Setup Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="development"
INSTALL_DEPS=true
SETUP_FIREBASE=true
SETUP_REDIS=true
GENERATE_SECRETS=true

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

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    local required_version="20.0.0"
    local current_version=$(node --version | sed 's/v//')
    
    if [ "$(printf '%s\n' "$required_version" "$current_version" | sort -V | head -n1)" != "$required_version" ]; then
        error_exit "Node.js version $required_version or higher is required. Current version: $current_version"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_message $BLUE "Installing dependencies..."
    
    if [ -f "package-lock.json" ]; then
        npm ci
    else
        npm install
    fi
    
    print_message $GREEN "Dependencies installed successfully!"
}

# Function to setup environment files
setup_environment() {
    print_message $BLUE "Setting up environment files..."
    
    # Copy environment template
    if [ ! -f ".env.${ENVIRONMENT}" ]; then
        cp .env.example .env.${ENVIRONMENT}
        print_message $YELLOW "Created .env.${ENVIRONMENT} file. Please update it with your configuration."
    else
        print_message $YELLOW ".env.${ENVIRONMENT} file already exists. Skipping..."
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Create uploads directory
    mkdir -p uploads
    
    print_message $GREEN "Environment setup completed!"
}

# Function to generate secrets
generate_secrets() {
    if [ "$GENERATE_SECRETS" = true ]; then
        print_message $BLUE "Generating secrets..."
        
        # Generate JWT secret
        JWT_SECRET=$(openssl rand -base64 64 2>/dev/null || date | md5sum | head -c 64)
        
        # Generate session secret
        SESSION_SECRET=$(openssl rand -base64 64 2>/dev/null || date | md5sum | head -c 64)
        
        # Generate API key secret
        API_KEY_SECRET=$(openssl rand -base64 64 2>/dev/null || date | md5sum | head -c 64)
        
        # Update environment file
        if [ -f ".env.${ENVIRONMENT}" ]; then
            # Backup existing file
            cp .env.${ENVIRONMENT} .env.${ENVIRONMENT}.backup
            
            # Update secrets
            sed -i.bak "s/JWT_SECRET=.*/JWT_SECRET=${JWT_SECRET}/" .env.${ENVIRONMENT}
            sed -i.bak "s/SESSION_SECRET=.*/SESSION_SECRET=${SESSION_SECRET}/" .env.${ENVIRONMENT}
            sed -i.bak "s/API_KEY_SECRET=.*/API_KEY_SECRET=${API_KEY_SECRET}/" .env.${ENVIRONMENT}
            
            # Remove backup files
            rm -f .env.${ENVIRONMENT}.bak .env.${ENVIRONMENT}.backup
        fi
        
        print_message $GREEN "Secrets generated and updated in .env.${ENVIRONMENT}"
    fi
}

# Function to setup Firebase
setup_firebase() {
    if [ "$SETUP_FIREBASE" = true ]; then
        print_message $BLUE "Setting up Firebase configuration..."
        
        # Check if Firebase CLI is installed
        if command_exists firebase; then
            print_message $GREEN "Firebase CLI is already installed."
        else
            print_message $YELLOW "Firebase CLI not found. Installing..."
            npm install -g firebase-tools
        fi
        
        # Login to Firebase (optional)
        print_message $YELLOW "Do you want to login to Firebase now? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            firebase login
        fi
        
        # Initialize Firebase project (optional)
        print_message $YELLOW "Do you want to initialize a Firebase project? (y/n)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            firebase init
        fi
        
        print_message $GREEN "Firebase setup completed!"
    fi
}

# Function to setup Redis
setup_redis() {
    if [ "$SETUP_REDIS" = true ]; then
        print_message $BLUE "Setting up Redis..."
        
        # Check if Redis is installed
        if command_exists redis-server; then
            print_message $GREEN "Redis is already installed."
            
            # Check if Redis is running
            if redis-cli ping >/dev/null 2>&1; then
                print_message $GREEN "Redis is running."
            else
                print_message $YELLOW "Redis is not running. Please start Redis service."
                print_message $BLUE "To start Redis on macOS: brew services start redis"
                print_message $BLUE "To start Redis on Ubuntu: sudo service redis-server start"
            fi
        else
            print_message $YELLOW "Redis not found. Please install Redis:"
            print_message $BLUE "macOS: brew install redis"
            print_message $BLUE "Ubuntu: sudo apt-get install redis-server"
            print_message $BLUE "Or use Docker: docker run -d -p 6379:6379 redis:alpine"
        fi
    fi
}

# Function to setup Git hooks
setup_git_hooks() {
    print_message $BLUE "Setting up Git hooks..."
    
    # Install Husky
    if [ -f "package.json" ] && grep -q "husky" package.json; then
        npx husky install
        
        # Create pre-commit hook
        cat > .husky/pre-commit << 'EOF'
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint:fix
npm run typecheck
git add -A
EOF
        
        chmod +x .husky/pre-commit
        
        print_message $GREEN "Git hooks setup completed!"
    else
        print_message $YELLOW "Husky not found in package.json. Skipping Git hooks setup."
    fi
}

# Function to run database migrations
run_migrations() {
    print_message $BLUE "Running database migrations..."
    
    # Check if migration script exists
    if [ -f "scripts/migrate.sh" ]; then
        bash scripts/migrate.sh
    else
        print_message $YELLOW "No migration script found. Skipping migrations."
    fi
}

# Function to verify setup
verify_setup() {
    print_message $BLUE "Verifying setup..."
    
    # Check Node.js
    if command_exists node; then
        check_node_version
        print_message $GREEN "✓ Node.js version check passed"
    else
        error_exit "Node.js is not installed"
    fi
    
    # Check npm
    if command_exists npm; then
        print_message $GREEN "✓ npm is installed"
    else
        error_exit "npm is not installed"
    fi
    
    # Check if required files exist
    local required_files=("package.json" "tsconfig.json" "src")
    for file in "${required_files[@]}"; do
        if [ -e "$file" ]; then
            print_message $GREEN "✓ $file exists"
        else
            print_message $RED "✗ $file is missing"
        fi
    done
    
    print_message $GREEN "Setup verification completed!"
}

# Function to display next steps
display_next_steps() {
    print_message $BLUE "\n=== Next Steps ==="
    print_message $NC "1. Update your .env.${ENVIRONMENT} file with your configuration"
    print_message $NC "2. Start Redis: redis-server"
    print_message $NC "3. Run the development server: npm run dev"
    print_message $NC "4. Visit http://localhost:5000/api-docs for API documentation"
    print_message $NC "5. Visit http://localhost:3000 for Grafana dashboards"
    print_message $NC "6. Visit http://localhost:16686 for Jaeger tracing"
    print_message $NC "\nFor production deployment, run: npm run deploy"
}

# Function to display help
display_help() {
    echo "AI Planner API Setup Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -e, --environment ENV    Set environment (development|staging|production)"
    echo "  -n, --no-deps           Skip dependency installation"
    echo "  -f, --no-firebase       Skip Firebase setup"
    echo "  -r, --no-redis          Skip Redis setup"
    echo "  -s, --no-secrets        Skip secret generation"
    echo "  -h, --help              Display this help message"
    echo
    echo "Examples:"
    echo "  $0                      # Setup for development environment"
    echo "  $0 -e production        # Setup for production environment"
    echo "  $0 -n -r                # Skip dependencies and Redis setup"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -n|--no-deps)
            INSTALL_DEPS=false
            shift
            ;;
        -f|--no-firebase)
            SETUP_FIREBASE=false
            shift
            ;;
        -r|--no-redis)
            SETUP_REDIS=false
            shift
            ;;
        -s|--no-secrets)
            GENERATE_SECRETS=false
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

# Main setup process
main() {
    print_message $BLUE "=== AI Planner API Setup ==="
    print_message $NC "Environment: $ENVIRONMENT"
    print_message $NC "Install dependencies: $INSTALL_DEPS"
    print_message $NC "Setup Firebase: $SETUP_FIREBASE"
    print_message $NC "Setup Redis: $SETUP_REDIS"
    print_message $NC "Generate secrets: $GENERATE_SECRETS"
    echo

    # Check prerequisites
    print_message $BLUE "Checking prerequisites..."
    if ! command_exists node; then
        error_exit "Node.js is not installed. Please install Node.js 20.x or higher."
    fi

    # Run setup steps
    if [ "$INSTALL_DEPS" = true ]; then
        install_dependencies
    fi

    setup_environment
    generate_secrets
    setup_firebase
    setup_redis
    setup_git_hooks
    run_migrations
    verify_setup

    # Display next steps
    display_next_steps

    print_message $GREEN "\n✅ Setup completed successfully!"
}

# Run main function
main "$@"
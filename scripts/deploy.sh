#!/bin/bash

# AI Planner API Deployment Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
DEPLOYMENT_TYPE="docker"
SKIP_TESTS=false
SKIP_BUILD=false
DRY_RUN=false
FORCE_DEPLOY=false

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

# Function to display help
display_help() {
    echo "AI Planner API Deployment Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -e, --environment ENV    Set environment (staging|production)"
    echo "  -t, --type TYPE         Deployment type (docker|kubernetes|pm2)"
    echo "  -s, --skip-tests        Skip running tests"
    echo "  -b, --skip-build        Skip build process"
    echo "  -d, --dry-run           Show what would be deployed without deploying"
    echo "  -f, --force             Force deployment without confirmation"
    echo "  -h, --help              Display this help message"
    echo
    echo "Examples:"
    echo "  $0                      # Deploy to production with Docker"
    echo "  $0 -e staging -t k8s    # Deploy to staging with Kubernetes"
    echo "  $0 -s -d                # Dry run deployment, skip tests"
}

# Function to run tests
run_tests() {
    if [ "$SKIP_TESTS" = true ]; then
        print_message $YELLOW "Skipping tests..."
        return
    fi

    print_message $BLUE "Running tests..."
    
    # Run linting
    npm run lint
    if [ $? -ne 0 ]; then
        error_exit "Linting failed"
    fi
    
    # Run type checking
    npm run typecheck
    if [ $? -ne 0 ]; then
        error_exit "Type checking failed"
    fi
    
    # Run unit tests
    npm run test:unit
    if [ $? -ne 0 ]; then
        error_exit "Unit tests failed"
    fi
    
    # Run integration tests
    npm run test:integration
    if [ $? -ne 0 ]; then
        error_exit "Integration tests failed"
    fi
    
    print_message $GREEN "All tests passed!"
}

# Function to build application
build_application() {
    if [ "$SKIP_BUILD" = true ]; then
        print_message $YELLOW "Skipping build..."
        return
    fi

    print_message $BLUE "Building application..."
    
    # Clean previous build
    rm -rf dist
    
    # Build TypeScript
    npm run build
    if [ $? -ne 0 ]; then
        error_exit "Build failed"
    fi
    
    print_message $GREEN "Build completed successfully!"
}

# Function to build Docker image
build_docker_image() {
    print_message $BLUE "Building Docker image..."
    
    local image_tag="ai-planner-api:${ENVIRONMENT}-$(date +%Y%m%d-%H%M%S)"
    local latest_tag="ai-planner-api:${ENVIRONMENT}-latest"
    
    # Build the image
    docker build -t ${image_tag} -t ${latest_tag} -f docker/Dockerfile .
    if [ $? -ne 0 ]; then
        error_exit "Docker build failed"
    fi
    
    # Save image tags for later use
    echo "${image_tag}" > .deploy-image-tag
    echo "${latest_tag}" >> .deploy-image-tag
    
    print_message $GREEN "Docker image built successfully: ${image_tag}"
}

# Function to deploy with Docker
deploy_docker() {
    print_message $BLUE "Deploying with Docker Compose..."
    
    # Load environment variables
    if [ -f ".env.${ENVIRONMENT}" ]; then
        export $(cat .env.${ENVIRONMENT} | grep -v '^#' | xargs)
    else
        error_exit "Environment file .env.${ENVIRONMENT} not found"
    fi
    
    # Get the image tag
    local image_tag=$(head -n 1 .deploy-image-tag)
    
    # Deploy using Docker Compose
    docker-compose -f docker/docker-compose.prod.yml down
    
    # Pull latest images
    docker-compose -f docker/docker-compose.prod.yml pull
    
    # Start services
    docker-compose -f docker/docker-compose.prod.yml up -d
    
    # Wait for services to be healthy
    print_message $BLUE "Waiting for services to be healthy..."
    sleep 30
    
    # Check health
    local health_check_url="http://localhost:5000/health"
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s ${health_check_url} >/dev/null; then
            print_message $GREEN "Application is healthy!"
            break
        else
            print_message $YELLOW "Waiting for application to be healthy... (attempt $attempt/$max_attempts)"
            sleep 10
            attempt=$((attempt + 1))
        fi
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error_exit "Application health check failed after $max_attempts attempts"
    fi
    
    print_message $GREEN "Docker deployment completed successfully!"
}

# Function to deploy with Kubernetes
deploy_kubernetes() {
    print_message $BLUE "Deploying with Kubernetes..."
    
    # Check if kubectl is installed
    if ! command_exists kubectl; then
        error_exit "kubectl is not installed"
    fi
    
    # Check if we can connect to cluster
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error_exit "Cannot connect to Kubernetes cluster"
    fi
    
    # Apply configurations
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secret.yaml
    kubectl apply -f k8s/deployment.yaml
    kubectl apply -f k8s/service.yaml
    kubectl apply -f k8s/ingress.yaml
    
    # Wait for deployment to be ready
    print_message $BLUE "Waiting for deployment to be ready..."
    kubectl rollout status deployment/ai-planner-api -n ai-planner --timeout=300s
    
    if [ $? -ne 0 ]; then
        error_exit "Kubernetes deployment failed"
    fi
    
    print_message $GREEN "Kubernetes deployment completed successfully!"
}

# Function to deploy with PM2
deploy_pm2() {
    print_message $BLUE "Deploying with PM2..."
    
    # Check if PM2 is installed
    if ! command_exists pm2; then
        print_message $YELLOW "PM2 not found. Installing..."
        npm install -g pm2
    fi
    
    # Stop existing PM2 processes
    pm2 stop ai-planner-api 2>/dev/null || true
    pm2 delete ai-planner-api 2>/dev/null || true
    
    # Start with PM2
    pm2 start ecosystem.config.js --env ${ENVIRONMENT}
    
    if [ $? -ne 0 ]; then
        error_exit "PM2 deployment failed"
    fi
    
    # Save PM2 configuration
    pm2 save
    
    # Setup startup script
    pm2 startup
    
    print_message $GREEN "PM2 deployment completed successfully!"
}

# Function to backup current deployment
backup_deployment() {
    print_message $BLUE "Creating backup of current deployment..."
    
    local backup_dir="backups/$(date +%Y%m%d-%H%M%S)"
    mkdir -p ${backup_dir}
    
    # Backup database (if applicable)
    if command_exists firebase; then
        print_message $YELLOW "Backing up Firebase data..."
        # Add Firebase backup commands here
    fi
    
    # Backup application files
    if [ -d "dist" ]; then
        cp -r dist ${backup_dir}/
    fi
    
    # Backup configuration
    cp -r config ${backup_dir}/ 2>/dev/null || true
    cp .env.${ENVIRONMENT} ${backup_dir}/ 2>/dev/null || true
    
    # Create backup manifest
    cat > ${backup_dir}/manifest.txt << EOF
Backup created: $(date)
Environment: ${ENVIRONMENT}
Git commit: $(git rev-parse HEAD 2>/dev/null || echo "Unknown")
Git branch: $(git branch --show-current 2>/dev/null || echo "Unknown")
EOF
    
    print_message $GREEN "Backup created at: ${backup_dir}"
}

# Function to rollback deployment
rollback_deployment() {
    print_message $BLUE "Rolling back deployment..."
    
    # Find latest backup
    local latest_backup=$(find backups -maxdepth 1 -type d -name "20*" | sort -r | head -n 1)
    
    if [ -z "${latest_backup}" ]; then
        error_exit "No backup found for rollback"
    fi
    
    print_message $YELLOW "Rolling back to: ${latest_backup}"
    
    # Restore files
    if [ -d "${latest_backup}/dist" ]; then
        rm -rf dist
        cp -r ${latest_backup}/dist ./
    fi
    
    # Restart services
    case ${DEPLOYMENT_TYPE} in
        docker)
            docker-compose -f docker/docker-compose.prod.yml restart
            ;;
        kubernetes)
            kubectl rollout undo deployment/ai-planner-api -n ai-planner
            ;;
        pm2)
            pm2 restart ai-planner-api
            ;;
    esac
    
    print_message $GREEN "Rollback completed successfully!"
}

# Function to send deployment notification
send_notification() {
    local status=$1
    local message=$2
    
    # Slack notification (if configured)
    if [ -n "${SLACK_WEBHOOK_URL}" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 AI Planner API Deployment - ${status}: ${message}\"}" \
            ${SLACK_WEBHOOK_URL}
    fi
    
    # Email notification (if configured)
    if [ -n "${DEPLOYMENT_EMAIL}" ]; then
        echo "${message}" | mail -s "AI Planner API Deployment - ${status}" ${DEPLOYMENT_EMAIL}
    fi
}

# Function to cleanup old deployments
cleanup_old_deployments() {
    print_message $BLUE "Cleaning up old deployments..."
    
    case ${DEPLOYMENT_TYPE} in
        docker)
            # Remove old Docker images
            docker image prune -f
            
            # Remove old containers
            docker container prune -f
            
            # Remove old volumes
            docker volume prune -f
            ;;
        kubernetes)
            # Remove old ReplicaSets
            kubectl delete replicasets -l app=ai-planner-api --field-selector=status.replicas=0 -n ai-planner
            
            # Remove old pods
            kubectl delete pods -l app=ai-planner-api --field-selector=status.phase=Succeeded -n ai-planner
            ;;
        pm2)
            # PM2 cleanup is handled automatically
            ;;
    esac
    
    print_message $GREEN "Cleanup completed!"
}

# Main deployment function
main() {
    print_message $BLUE "=== AI Planner API Deployment ==="
    print_message $NC "Environment: $ENVIRONMENT"
    print_message $NC "Deployment Type: $DEPLOYMENT_TYPE"
    print_message $NC "Skip Tests: $SKIP_TESTS"
    print_message $NC "Skip Build: $SKIP_BUILD"
    print_message $NC "Dry Run: $DRY_RUN"
    echo

    # Confirmation
    if [ "$FORCE_DEPLOY" = false ] && [ "$DRY_RUN" = false ]; then
        print_message $YELLOW "Are you sure you want to deploy to $ENVIRONMENT environment? (yes/no)"
        read -r response
        if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
            print_message $YELLOW "Deployment cancelled."
            exit 0
        fi
    fi

    # Create backup
    if [ "$DRY_RUN" = false ]; then
        backup_deployment
    fi

    # Run tests
    run_tests

    # Build application
    build_application

    # Build Docker image if needed
    if [ "$DEPLOYMENT_TYPE" = "docker" ] || [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        build_docker_image
    fi

    # Dry run
    if [ "$DRY_RUN" = true ]; then
        print_message $YELLOW "Dry run completed. No actual deployment performed."
        exit 0
    fi

    # Deploy
    case ${DEPLOYMENT_TYPE} in
        docker)
            deploy_docker
            ;;
        kubernetes|k8s)
            deploy_kubernetes
            ;;
        pm2)
            deploy_pm2
            ;;
        *)
            error_exit "Unknown deployment type: ${DEPLOYMENT_TYPE}"
            ;;
    esac

    # Cleanup
    cleanup_old_deployments

    # Send notification
    send_notification "SUCCESS" "Deployment to ${ENVIRONMENT} completed successfully"

    print_message $GREEN "\n✅ Deployment completed successfully!"
    print_message $NC "Check your application at: http://localhost:5000/health"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--type)
            DEPLOYMENT_TYPE="$2"
            shift 2
            ;;
        -s|--skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        -b|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -f|--force)
            FORCE_DEPLOY=true
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
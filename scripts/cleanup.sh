#!/bin/bash

# AI Planner API Cleanup Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
CLEAN_TYPE="all"
FORCE=false
RETENTION_DAYS=7
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
    echo "AI Planner API Cleanup Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -t, --type TYPE        Cleanup type (all|logs|cache|docker|temp|backups)"
    echo "  -f, --force           Force cleanup without confirmation"
    echo "  -r, --retention DAYS  Retention period in days (default: 7)"
    echo "  -d, --dry-run         Show what would be cleaned without cleaning"
    echo "  -h, --help            Display this help message"
    echo
    echo "Examples:"
    echo "  $0                    # Clean all with default retention"
    echo "  $0 -t logs -r 30      # Clean logs older than 30 days"
    echo "  $0 -t docker -f       # Force clean Docker resources"
}

# Function to confirm action
confirm_action() {
    local action=$1
    
    if [ "$FORCE" = true ]; then
        return 0
    fi
    
    print_message $YELLOW "Are you sure you want to $action? (yes/no)"
    read -r response
    [[ "$response" =~ ^[Yy][Ee][Ss]$ ]]
}

# Function to clean logs
clean_logs() {
    print_message $BLUE "Cleaning old log files..."
    
    local log_dirs=("logs" "nginx/logs" "docker/logs")
    local cleaned_count=0
    
    for log_dir in "${log_dirs[@]}"; do
        if [ -d "$log_dir" ]; then
            if [ "$DRY_RUN" = true ]; then
                find "$log_dir" -name "*.log" -type f -mtime +${RETENTION_DAYS} -print | while read -r file; do
                    print_message $YELLOW "DRY RUN: Would delete $file"
                    cleaned_count=$((cleaned_count + 1))
                done
            else
                find "$log_dir" -name "*.log" -type f -mtime +${RETENTION_DAYS} -delete -print | while read -r file; do
                    print_message $GREEN "Deleted: $file"
                    cleaned_count=$((cleaned_count + 1))
                done
            fi
        fi
    done
    
    # Clean PM2 logs
    if command_exists pm2; then
        if [ "$DRY_RUN" = true ]; then
            print_message $YELLOW "DRY RUN: Would flush PM2 logs"
        else
            pm2 flush
            print_message $GREEN "PM2 logs flushed"
        fi
    fi
    
    print_message $GREEN "Log cleanup completed. $cleaned_count files processed."
}

# Function to clean cache
clean_cache() {
    print_message $BLUE "Cleaning cache..."
    
    # Clean npm cache
    if [ "$DRY_RUN" = true ]; then
        print_message $YELLOW "DRY RUN: Would clean npm cache"
    else
        npm cache clean --force
        print_message $GREEN "npm cache cleaned"
    fi
    
    # Clean Node.js require cache
    if [ -d "node_modules/.cache" ]; then
        if [ "$DRY_RUN" = true ]; then
            print_message $YELLOW "DRY RUN: Would clean Node.js cache"
        else
            rm -rf node_modules/.cache
            print_message $GREEN "Node.js cache cleaned"
        fi
    fi
    
    # Clean Redis cache
    if command_exists redis-cli; then
        if redis-cli ping >/dev/null 2>&1; then
            if confirm_action "flush Redis cache"; then
                if [ "$DRY_RUN" = true ]; then
                    print_message $YELLOW "DRY RUN: Would flush Redis cache"
                else
                    redis-cli FLUSHALL
                    print_message $GREEN "Redis cache flushed"
                fi
            fi
        fi
    fi
    
    # Clean system cache (if running as root)
    if [ "$(id -u)" = "0" ]; then
        if confirm_action "clean system cache"; then
            if [ "$DRY_RUN" = true ]; then
                print_message $YELLOW "DRY RUN: Would clean system cache"
            else
                sync && echo 3 > /proc/sys/vm/drop_caches
                print_message $GREEN "System cache cleaned"
            fi
        fi
    fi
}

# Function to clean Docker resources
clean_docker() {
    if ! command_exists docker; then
        print_message $YELLOW "Docker not found. Skipping Docker cleanup."
        return
    fi
    
    print_message $BLUE "Cleaning Docker resources..."
    
    # Remove stopped containers
    local stopped_containers=$(docker ps -aq -f status=exited)
    if [ -n "$stopped_containers" ]; then
        if confirm_action "remove $(echo $stopped_containers | wc -w) stopped containers"; then
            if [ "$DRY_RUN" = true ]; then
                echo "$stopped_containers" | while read container; do
                    print_message $YELLOW "DRY RUN: Would remove container $container"
                done
            else
                echo "$stopped_containers" | xargs docker rm -f
                print_message $GREEN "Stopped containers removed"
            fi
        fi
    fi
    
    # Remove dangling images
    local dangling_images=$(docker images -q -f dangling=true)
    if [ -n "$dangling_images" ]; then
        if confirm_action "remove $(echo $dangling_images | wc -w) dangling images"; then
            if [ "$DRY_RUN" = true ]; then
                echo "$dangling_images" | while read image; do
                    print_message $YELLOW "DRY RUN: Would remove image $image"
                done
            else
                echo "$dangling_images" | xargs docker rmi -f
                print_message $GREEN "Dangling images removed"
            fi
        fi
    fi
    
    # Remove unused volumes
    local unused_volumes=$(docker volume ls -q -f dangling=true)
    if [ -n "$unused_volumes" ]; then
        if confirm_action "remove $(echo $unused_volumes | wc -w) unused volumes"; then
            if [ "$DRY_RUN" = true ]; then
                echo "$unused_volumes" | while read volume; do
                    print_message $YELLOW "DRY RUN: Would remove volume $volume"
                done
            else
                echo "$unused_volumes" | xargs docker volume rm -f
                print_message $GREEN "Unused volumes removed"
            fi
        fi
    fi
    
    # Remove unused networks
    local unused_networks=$(docker network ls -q -f dangling=true)
    if [ -n "$unused_networks" ]; then
        if confirm_action "remove $(echo $unused_networks | wc -w) unused networks"; then
            if [ "$DRY_RUN" = true ]; then
                echo "$unused_networks" | while read network; do
                    print_message $YELLOW "DRY RUN: Would remove network $network"
                done
            else
                echo "$unused_networks" | xargs docker network rm
                print_message $GREEN "Unused networks removed"
            fi
        fi
    fi
    
    # System prune (comprehensive cleanup)
    if confirm_action "run comprehensive Docker system prune"; then
        if [ "$DRY_RUN" = true ]; then
            print_message $YELLOW "DRY RUN: Would run 'docker system prune -a -f'"
        else
            docker system prune -a -f --volumes
            print_message $GREEN "Docker system pruned"
        fi
    fi
}

# Function to clean temporary files
clean_temp_files() {
    print_message $BLUE "Cleaning temporary files..."
    
    local temp_patterns=(
        "*.tmp"
        "*.temp"
        "*.log.*"
        "*.pid"
        ".DS_Store"
        "Thumbs.db"
        "*~"
    )
    
    local cleaned_count=0
    
    for pattern in "${temp_patterns[@]}"; do
        if [ "$DRY_RUN" = true ]; then
            find . -name "$pattern" -type f -print 2>/dev/null | while read -r file; do
                print_message $YELLOW "DRY RUN: Would delete $file"
                cleaned_count=$((cleaned_count + 1))
            done
        else
            find . -name "$pattern" -type f -delete -print 2>/dev/null | while read -r file; do
                print_message $GREEN "Deleted: $file"
                cleaned_count=$((cleaned_count + 1))
            done
        fi
    done
    
    # Clean Node.js temporary files
    if [ -d "node_modules" ]; then
        find node_modules -name ".cache" -type d -exec rm -rf {} + 2>/dev/null || true
    fi
    
    # Clean build artifacts
    if [ "$DRY_RUN" = true ]; then
        [ -d "dist" ] && print_message $YELLOW "DRY RUN: Would remove dist directory"
        [ -d "build" ] && print_message $YELLOW "DRY RUN: Would remove build directory"
        [ -d ".next" ] && print_message $YELLOW "DRY RUN: Would remove .next directory"
    else
        [ -d "dist" ] && rm -rf dist && print_message $GREEN "Removed dist directory"
        [ -d "build" ] && rm -rf build && print_message $GREEN "Removed build directory"
        [ -d ".next" ] && rm -rf .next && print_message $GREEN "Removed .next directory"
    fi
    
    print_message $GREEN "Temporary files cleanup completed. $cleaned_count files processed."
}

# Function to clean old backups
clean_backups() {
    print_message $BLUE "Cleaning old backups..."
    
    if [ -d "backups" ]; then
        local old_backups=$(find backups -name "*.tar*" -type f -mtime +${RETENTION_DAYS})
        
        if [ -n "$old_backups" ]; then
            local backup_count=$(echo "$old_backups" | wc -l)
            
            if confirm_action "delete $backup_count old backups"; then
                if [ "$DRY_RUN" = true ]; then
                    echo "$old_backups" | while read -r backup; do
                        print_message $YELLOW "DRY RUN: Would delete $backup"
                    done
                else
                    echo "$old_backups" | xargs rm -f
                    print_message $GREEN "Deleted $backup_count old backups"
                fi
            fi
        else
            print_message $GREEN "No old backups to delete"
        fi
    fi
}

# Function to clean node_modules
clean_node_modules() {
    if confirm_action "remove node_modules and reinstall dependencies"; then
        if [ "$DRY_RUN" = true ]; then
            print_message $YELLOW "DRY RUN: Would remove node_modules and package-lock.json"
        else
            rm -rf node_modules package-lock.json
            print_message $GREEN "Removed node_modules and package-lock.json"
            print_message $BLUE "Reinstalling dependencies..."
            npm install
            print_message $GREEN "Dependencies reinstalled"
        fi
    fi
}

# Function to get disk usage
get_disk_usage() {
    local path=${1:-.}
    du -sh "$path" 2>/dev/null | cut -f1
}

# Function to show cleanup summary
show_cleanup_summary() {
    print_message $BLUE "Disk Usage Summary:"
    echo "==================="
    
    local directories=(
        ".:$(get_disk_usage)"
        "node_modules:$(get_disk_usage node_modules 2>/dev/null || echo "N/A")"
        "logs:$(get_disk_usage logs 2>/dev/null || echo "N/A")"
        "dist:$(get_disk_usage dist 2>/dev/null || echo "N/A")"
        "backups:$(get_disk_usage backups 2>/dev/null || echo "N/A")"
    )
    
    for dir_info in "${directories[@]}"; do
        IFS=':' read -r path size <<< "$dir_info"
        printf "%-20s %s\n" "$path:" "$size"
    done
    
    # Docker disk usage
    if command_exists docker; then
        print_message $NC "\nDocker Disk Usage:"
        docker system df
    fi
}

# Main cleanup function
main() {
    print_message $BLUE "=== AI Planner API Cleanup ==="
    print_message $NC "Cleanup Type: $CLEAN_TYPE"
    print_message $NC "Retention: $RETENTION_DAYS days"
    print_message $NC "Dry Run: $DRY_RUN"
    echo

    # Show current disk usage
    show_cleanup_summary
    echo

    # Confirmation
    if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
        print_message $YELLOW "Are you sure you want to perform cleanup? (yes/no)"
        read -r response
        if [[ ! "$response" =~ ^[Yy][Ee][Ss]$ ]]; then
            print_message $YELLOW "Cleanup cancelled."
            exit 0
        fi
    fi

    # Perform cleanup based on type
    case ${CLEAN_TYPE} in
        all)
            clean_logs
            clean_cache
            clean_temp_files
            clean_backups
            ;;
        logs)
            clean_logs
            ;;
        cache)
            clean_cache
            ;;
        docker)
            clean_docker
            ;;
        temp)
            clean_temp_files
            ;;
        backups)
            clean_backups
            ;;
        node_modules)
            clean_node_modules
            ;;
        *)
            error_exit "Unknown cleanup type: ${CLEAN_TYPE}"
            ;;
    esac

    echo
    show_cleanup_summary
    
    print_message $GREEN "\n✅ Cleanup completed successfully!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -t|--type)
            CLEAN_TYPE="$2"
            shift 2
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -r|--retention)
            RETENTION_DAYS="$2"
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
#!/bin/bash

# AI Planner API Health Check Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
API_URL="http://localhost:5000"
TIMEOUT=10
RETRIES=3
VERBOSE=false
CHECK_EXTERNAL=false

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
    echo "AI Planner API Health Check Script"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -u, --url URL          API base URL (default: http://localhost:5000)"
    echo "  -t, --timeout SECONDS  Request timeout in seconds (default: 10)"
    echo "  -r, --retries COUNT    Number of retry attempts (default: 3)"
    echo "  -e, --external         Check external dependencies"
    echo "  -v, --verbose          Verbose output"
    echo "  -h, --help             Display this help message"
    echo
    echo "Examples:"
    echo "  $0                     # Basic health check"
    echo "  $0 -e -v               # Check with external dependencies, verbose"
    echo "  $0 -u https://api.example.com -t 30"
}

# Function to make HTTP request
make_request() {
    local endpoint=$1
    local method=${2:-GET}
    local expected_status=${3:-200}
    
    local url="${API_URL}${endpoint}"
    local attempt=1
    
    while [ $attempt -le $RETRIES ]; do
        if [ "$VERBOSE" = true ]; then
            print_message $BLUE "Attempt $attempt: $method $url"
        fi
        
        local response=$(curl -s -w "\n%{http_code}" -X $method \
            --max-time $TIMEOUT \
            -H "Content-Type: application/json" \
            "$url" 2>/dev/null || echo -e "\n000")
        
        local http_code=$(echo "$response" | tail -n 1)
        local body=$(echo "$response" | head -n -1)
        
        if [ "$http_code" = "$expected_status" ]; then
            if [ "$VERBOSE" = true ]; then
                print_message $GREEN "✓ $method $url - Status: $http_code"
                if [ -n "$body" ] && [ "$body" != "null" ]; then
                    echo "$body" | jq . 2>/dev/null || echo "$body"
                fi
            fi
            return 0
        else
            if [ "$VERBOSE" = true ]; then
                print_message $RED "✗ $method $url - Status: $http_code (Expected: $expected_status)"
                if [ -n "$body" ]; then
                    echo "$body" | jq . 2>/dev/null || echo "$body"
                fi
            fi
        fi
        
        attempt=$((attempt + 1))
        if [ $attempt -le $RETRIES ]; then
            sleep 2
        fi
    done
    
    return 1
}

# Function to check service health
check_service_health() {
    local service=$1
    local check_command=$2
    
    if eval "$check_command"; then
        print_message $GREEN "✓ $service is healthy"
        return 0
    else
        print_message $RED "✗ $service is unhealthy"
        return 1
    fi
}

# Function to check API endpoints
check_api_endpoints() {
    print_message $BLUE "Checking API endpoints..."
    
    local endpoints=(
        "/health|GET|200"
        "/health/detailed|GET|200"
        "/health/ready|GET|200"
        "/health/live|GET|200"
        "/metrics|GET|200"
        "/api-docs|GET|200"
    )
    
    local failed_checks=0
    
    for endpoint_config in "${endpoints[@]}"; do
        IFS='|' read -r endpoint method expected_status <<< "$endpoint_config"
        
        if make_request "$endpoint" "$method" "$expected_status"; then
            :
        else
            failed_checks=$((failed_checks + 1))
        fi
    done
    
    return $failed_checks
}

# Function to check database connections
check_databases() {
    print_message $BLUE "Checking database connections..."
    
    # Check Firebase
    if node -e "
        const admin = require('firebase-admin');
        try {
            const serviceAccount = {
                projectId: process.env.FIREBASE_PROJECT_ID || 'test',
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'test@test.com',
                privateKey: (process.env.FIREBASE_PRIVATE_KEY || 'test').replace(/\\\\n/g, '\\n')
            };
            
            if (!admin.apps.length) {
                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount)
                });
            }
            
            const db = admin.firestore();
            db.collection('__health__').limit(1).get()
                .then(() => {
                    console.log('Firebase connection successful');
                    process.exit(0);
                })
                .catch(err => {
                    console.error('Firebase connection failed:', err);
                    process.exit(1);
                });
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            process.exit(1);
        }
    " 2>/dev/null; then
        print_message $GREEN "✓ Firebase connection is healthy"
    else
        print_message $RED "✗ Firebase connection failed"
        return 1
    fi
    
    # Check Redis
    if command_exists redis-cli; then
        if redis-cli ping >/dev/null 2>&1; then
            print_message $GREEN "✓ Redis connection is healthy"
        else
            print_message $RED "✗ Redis connection failed"
            return 1
        fi
    else
        print_message $YELLOW "⚠ Redis CLI not available, skipping Redis check"
    fi
    
    return 0
}

# Function to check external dependencies
check_external_dependencies() {
    print_message $BLUE "Checking external dependencies..."
    
    local failed_checks=0
    
    # Check external APIs (if configured)
    if [ -n "${EXTERNAL_APIS}" ]; then
        IFS=',' read -ra APIS <<< "$EXTERNAL_APIS"
        for api in "${APIS[@]}"; do
            if make_request "/health/external?service=${api}" "GET" "200"; then
                :
            else
                failed_checks=$((failed_checks + 1))
            fi
        done
    fi
    
    # Check email service
    if [ -n "${SMTP_HOST}" ]; then
        if timeout 5 bash -c "echo > /dev/tcp/${SMTP_HOST}/${SMTP_PORT:-587}" 2>/dev/null; then
            print_message $GREEN "✓ Email service (SMTP) is reachable"
        else
            print_message $RED "✗ Email service (SMTP) is unreachable"
            failed_checks=$((failed_checks + 1))
        fi
    fi
    
    return $failed_checks
}

# Function to check system resources
check_system_resources() {
    print_message $BLUE "Checking system resources..."
    
    # Check memory usage
    local memory_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
    if [ "$memory_usage" -lt 90 ]; then
        print_message $GREEN "✓ Memory usage is normal (${memory_usage}%)"
    else
        print_message $RED "✗ Memory usage is high (${memory_usage}%)"
        return 1
    fi
    
    # Check disk usage
    local disk_usage=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 90 ]; then
        print_message $GREEN "✓ Disk usage is normal (${disk_usage}%)"
    else
        print_message $RED "✗ Disk usage is high (${disk_usage}%)"
        return 1
    fi
    
    # Check CPU load
    local cpu_cores=$(nproc)
    local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    local load_pct=$(echo "$load_avg * 100 / $cpu_cores" | bc -l | cut -d'.' -f1)
    
    if [ "$load_pct" -lt 80 ]; then
        print_message $GREEN "✓ CPU load is normal (${load_pct}%)"
    else
        print_message $RED "✗ CPU load is high (${load_pct}%)"
        return 1
    fi
    
    return 0
}

# Function to check SSL certificates
check_ssl_certificates() {
    if [ -d "nginx/ssl" ]; then
        print_message $BLUE "Checking SSL certificates..."
        
        local cert_files=$(find nginx/ssl -name "*.crt" -o -name "*.pem" 2>/dev/null)
        
        if [ -n "$cert_files" ]; then
            for cert in $cert_files; do
                local expiry=$(openssl x509 -enddate -noout -in "$cert" | cut -d= -f2)
                local expiry_epoch=$(date -d "$expiry" +%s)
                local current_epoch=$(date +%s)
                local days_until_expiry=$(( (expiry_epoch - current_epoch) / 86400 ))
                
                if [ $days_until_expiry -gt 30 ]; then
                    print_message $GREEN "✓ SSL certificate valid for $days_until_expiry days"
                elif [ $days_until_expiry -gt 7 ]; then
                    print_message $YELLOW "⚠ SSL certificate expires in $days_until_expiry days"
                else
                    print_message $RED "✗ SSL certificate expires in $days_until_expiry days"
                    return 1
                fi
            done
        else
            print_message $YELLOW "No SSL certificates found"
        fi
    fi
    
    return 0
}

# Function to run comprehensive health check
run_health_check() {
    local failed_checks=0
    
    # Check API endpoints
    check_api_endpoints || failed_checks=$((failed_checks + 1))
    
    # Check databases
    check_databases || failed_checks=$((failed_checks + 1))
    
    # Check system resources
    check_system_resources || failed_checks=$((failed_checks + 1))
    
    # Check SSL certificates
    check_ssl_certificates || failed_checks=$((failed_checks + 1))
    
    # Check external dependencies if requested
    if [ "$CHECK_EXTERNAL" = true ]; then
        check_external_dependencies || failed_checks=$((failed_checks + 1))
    fi
    
    return $failed_checks
}

# Function to generate health report
generate_health_report() {
    local timestamp=$(date +%Y-%m-%d_%H-%M-%S)
    local report_file="health-report-${timestamp}.json"
    
    cat > "$report_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "hostname": "$(hostname)",
  "environment": "${ENVIRONMENT}",
  "api_url": "${API_URL}",
  "checks": {
    "api_endpoints": $(check_api_endpoints &>/dev/null && echo "true" || echo "false"),
    "databases": $(check_databases &>/dev/null && echo "true" || echo "false"),
    "system_resources": $(check_system_resources &>/dev/null && echo "true" || echo "false"),
    "ssl_certificates": $(check_ssl_certificates &>/dev/null && echo "true" || echo "false"),
    "external_dependencies": $([ "$CHECK_EXTERNAL" = true ] && (check_external_dependencies &>/dev/null && echo "true" || echo "false") || echo "null")
  },
  "system_info": {
    "memory_usage": "$(free | grep Mem | awk '{printf \"%.1f%%\", $3/$2 * 100.0}')",
    "disk_usage": "$(df / | tail -1 | awk '{print $5}')",
    "cpu_load": "$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')",
    "uptime": "$(uptime -p)"
  }
}
EOF
    
    print_message $GREEN "Health report generated: $report_file"
}

# Main function
main() {
    print_message $BLUE "=== AI Planner API Health Check ==="
    print_message $NC "API URL: $API_URL"
    print_message $NC "Timeout: ${TIMEOUT}s"
    print_message $NC "Retries: $RETRIES"
    print_message $NC "Check External: $CHECK_EXTERNAL"
    print_message $NC "Verbose: $VERBOSE"
    echo

    # Run health check
    local failed_checks=0
    
    if [ "$VERBOSE" = true ]; then
        run_health_check
        failed_checks=$?
    else
        run_health_check >/dev/null 2>&1
        failed_checks=$?
    fi
    
    # Generate report
    generate_health_report
    
    # Summary
    echo
    if [ $failed_checks -eq 0 ]; then
        print_message $GREEN "✅ All health checks passed!"
        exit 0
    else
        print_message $RED "❌ $failed_checks health check(s) failed!"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            API_URL="$2"
            shift 2
            ;;
        -t|--timeout)
            TIMEOUT="$2"
            shift 2
            ;;
        -r|--retries)
            RETRIES="$2"
            shift 2
            ;;
        -e|--external)
            CHECK_EXTERNAL=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            display_help
            exit 0
            ;;
        *)
            print_message $RED "Unknown option: $1"
            display_help
            exit 1
            ;;
    esac
done

# Export environment variables for Node.js scripts
export NODE_ENV="${NODE_ENV:-production}"
export FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID}"
export FIREBASE_CLIENT_EMAIL="${FIREBASE_CLIENT_EMAIL}"
export FIREBASE_PRIVATE_KEY="${FIREBASE_PRIVATE_KEY}"
export REDIS_HOST="${REDIS_HOST:-localhost}"
export REDIS_PORT="${REDIS_PORT:-6379}"
export SMTP_HOST="${SMTP_HOST}"
export SMTP_PORT="${SMTP_PORT:-587}"
export EXTERNAL_APIS="${EXTERNAL_APIS}"

# Run main function
main "$@"
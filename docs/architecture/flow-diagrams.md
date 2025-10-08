# System Flow Diagrams

## Authentication Flow

### User Registration Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as API
    participant V as Validation
    participant F as Firebase
    participant E as Email Service
    participant D as Database

    U-&gt;&gt;A: POST /auth/register
    A-&gt;&gt;V: Validate Input
    V--&gt;&gt;A: Validation Result
    
    alt Validation Failed
        A--&gt;&gt;U: 422 Validation Error
    else Validation Passed
        A-&gt;&gt;F: Create User Account
        F--&gt;&gt;A: User Created
        
        A-&gt;&gt;D: Create User Document
        D--&gt;&gt;A: Document Created
        
        A-&gt;&gt;E: Send Verification Email
        E--&gt;&gt;A: Email Sent
        
        A--&gt;&gt;U: 201 Created + User Data
    end

mermaid```
User Login Flow

sequenceDiagram
    participant U as User
    participant A as API
    participant V as Validation
    participant F as Firebase
    participant R as Redis
    participant T as Token Service

    U->>A: POST /auth/login
    A->>V: Validate Credentials
    V-->>A: Validation Result
    
    alt Validation Failed
        A-->>U: 401 Invalid Credentials
    else Validation Passed
        A->>F: Verify User Credentials
        F-->>A: User Data
        
        A->>R: Check Account Status
        R-->>A: Account OK
        
        A->>T: Generate Tokens
        T-->>A: Access & Refresh Tokens
        
        A->>R: Store Session
        R-->>A: Session Stored
        
        A-->>U: 200 OK + Tokens + User
    end

Planner Management Flow
Create Planner Flow

sequenceDiagram
    participant U as User
    participant A as API
    participant V as Validation
    participant S as Service Layer
    participant F as Firebase
    participant AI as AI Service

    U->>A: POST /planners
    A->>V: Validate Request
    V-->>A: Valid
    
    A->>S: Create Planner Service
    S->>F: Create Planner Document
    F-->>S: Document Created
    
    S->>AI: Generate Default Sections
    AI-->>S: AI Suggestions
    
    S->>F: Create Sections
    F-->>S: Sections Created
    
    S-->>A: Planner Created
    A-->>U: 201 Created + Planner Data

Real-time Collaboration Flow

sequenceDiagram
    participant U1 as User 1
    participant U2 as User 2
    participant W as WebSocket Server
    participant C as Collaboration Service
    participant D as Database
    participant N as Notification Service

    U1->>W: Connect to /ws
    W-->>U1: Connected
    
    U2->>W: Connect to /ws
    W-->>U2: Connected
    
    U1->>W: join-planner {plannerId: "123"}
    W->>C: Add User to Room
    C->>D: Update Collaborators
    C-->>W: User Joined
    W-->>U2: collaborator-joined {user: U1}
    
    U1->>W: activity-created {activity: data}
    W->>C: Validate Permission
    C->>D: Save Activity
    D-->>C: Activity Saved
    C-->>W: Broadcast Event
    W-->>U2: activity-created {activity: data}
    W-->>N: Send Notification
    N-->>U2: Push Notification

AI Processing Flow
AI Task Suggestion Flow

sequenceDiagram
    participant U as User
    participant A as API
    participant V as Validation
    participant AI as AI Service
    participant C as Cache
    participant Q as Queue

    U->>A: POST /ai/suggest-tasks
    A->>V: Validate Input
    V-->>A: Valid
    
    A->>C: Check Cache
    alt Cache Hit
        C-->>A: Cached Results
        A-->>U: Return Cached Suggestions
    else Cache Miss
        A->>Q: Queue AI Request
        Q-->>A: Job Queued
        
        A-->>U: 202 Accepted + Job ID
        
        Q->>AI: Process Request
        AI->>AI: Generate Suggestions
        AI-->>Q: Results Ready
        
        Q->>C: Cache Results
        Q->>N: Notify User (if subscribed)
    end


Schedule Optimization Flow

sequenceDiagram
    participant U as User
    participant A as API
    participant S as Scheduler Service
    participant AI as AI Optimization
    participant C as Calendar Service
    participant D as Database

    U->>A: POST /ai/optimize-schedule
    A->>S: Schedule Optimization Request
    
    S->>D: Get User Activities
    D-->>S: Activities List
    
    S->>C: Get Calendar Events
    C-->>S: Calendar Data
    
    S->>AI: Optimize Schedule
    AI->>AI: Analyze Patterns
    AI->>AI: Apply Constraints
    AI->>AI: Generate Optimal Schedule
    
    AI-->>S: Optimized Schedule
    S-->>A: Optimization Results
    A-->>U: Optimized Schedule + Insights

Export Flow
PDF Export Flow

sequenceDiagram
    participant U as User
    participant A as API
    participant Q as Queue
    participant E as Export Service
    participant S as Storage
    participant N as Notification

    U->>A: POST /export/pdf
    A->>A: Validate Request
    
    A->>Q: Queue Export Job
    Q-->>A: Job ID
    
    A-->>U: 202 Accepted + Export ID
    
    Q->>E: Process Export
    E->>D: Fetch Planner Data
    D-->>E: Planner + Activities
    
    E->>E: Generate PDF
    E->>S: Upload PDF
    S-->>E: File URL
    
    E->>Q: Update Job Status
    E->>N: Send Notification
    N-->>U: Export Ready Email
    
    U->>A: GET /export/{id}/status
    A-->>U: Ready + Download URL


Background Job Processing Flow
Email Queue Flow

sequenceDiagram
    participant A as Application
    participant Q as Queue
    participant W as Worker
    participant M as Mail Service
    participant U as User

    A->>Q: Add Email Job
    Q-->>A: Job ID
    
    Q->>W: Dispatch Job
    W->>W: Process Job
    
    alt Success
        W->>M: Send Email
        M-->>W: Email Sent
        W->>Q: Mark Complete
    else Failed
        W->>Q: Mark Failed
        Q->>Q: Retry Logic
        alt Retry Available
            Q->>W: Retry Job
        else Max Retries
            Q->>A: Notify Failure
            A->>A: Log Error
        end
    end

Real-time Notification Flow
Push Notification Flow

sequenceDiagram
    participant C as Client
    participant S as Server
    participant Q as Queue
    participant N as Notification Service
    participant P as Push Service
    participant D as Device

    C->>S: Subscribe to Notifications
    S->>S: Store Subscription
    
    S->>Q: Queue Notification
    Q-->>S: Job Queued
    
    Q->>N: Process Notification
    N->>N: Format Message
    
    N->>P: Send to Push Service
    P->>D: Deliver to Device
    D-->>P: Delivered
    
    P-->>N: Delivery Confirmed
    N->>Q: Mark Complete

Database Transaction Flow
Multi-document Transaction

sequenceDiagram
    participant S as Service
    participant T as Transaction
    participant D1 as Document 1
    participant D2 as Document 2
    participant D3 as Document 3

    S->>T: Begin Transaction
    
    T->>D1: Read Document
    D1-->>T: Document Data
    
    T->>D2: Update Document
    T->>D3: Create Document
    
    alt All Operations Success
        T->>T: Commit Transaction
        T-->>S: Transaction Committed
    else Any Operation Fails
        T->>T: Rollback Transaction
        T-->>S: Transaction Rolled Back
    end

Monitoring and Alerting Flow
Metrics Collection Flow

sequenceDiagram
    participant A as Application
    participant M as Metrics Collector
    participant P as Prometheus
    participant G as Grafana
    participant S as Slack

    A->>M: Record Metric
    M->>M: Process Metric
    
    M->>P: Export Metrics
    P->>P: Store Time Series
    
    P->>G: Query Metrics
    G->>G: Evaluate Alerts
    
    alt Alert Triggered
        G->>S: Send Alert
        S-->>G: Alert Sent
    end
    
    G->>G: Update Dashboard



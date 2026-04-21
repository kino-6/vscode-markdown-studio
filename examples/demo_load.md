# Markdown Studio — Load Test

This file contains complex diagrams to test rendering performance on low-spec machines.

## 1. Large Mermaid Flowchart

```mermaid
flowchart TD
    A[Start] --> B{Decision 1}
    B -->|Yes| C[Process A]
    B -->|No| D[Process B]
    C --> E{Decision 2}
    D --> F{Decision 3}
    E -->|Yes| G[Sub-process A1]
    E -->|No| H[Sub-process A2]
    F -->|Yes| I[Sub-process B1]
    F -->|No| J[Sub-process B2]
    G --> K[Merge Point 1]
    H --> K
    I --> L[Merge Point 2]
    J --> L
    K --> M{Decision 4}
    L --> M
    M -->|Path 1| N[Handler Alpha]
    M -->|Path 2| O[Handler Beta]
    M -->|Path 3| P[Handler Gamma]
    N --> Q[Validation]
    O --> Q
    P --> Q
    Q --> R{Valid?}
    R -->|Yes| S[Commit]
    R -->|No| T[Rollback]
    S --> U[Notify Success]
    T --> V[Notify Failure]
    U --> W[End]
    V --> W
```

## 2. Complex Sequence Diagram

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant GW as API Gateway
    participant Auth as Auth Service
    participant US as User Service
    participant OS as Order Service
    participant PS as Payment Service
    participant NS as Notification Service
    participant DB as Database
    participant Cache as Redis Cache
    participant MQ as Message Queue

    U->>FE: Login Request
    FE->>GW: POST /auth/login
    GW->>Auth: Validate Credentials
    Auth->>DB: Query User
    DB-->>Auth: User Record
    Auth->>Cache: Store Session
    Cache-->>Auth: OK
    Auth-->>GW: JWT Token
    GW-->>FE: 200 OK + Token
    FE-->>U: Dashboard

    U->>FE: Place Order
    FE->>GW: POST /orders
    GW->>Auth: Verify Token
    Auth->>Cache: Check Session
    Cache-->>Auth: Valid
    Auth-->>GW: Authorized
    GW->>OS: Create Order
    OS->>DB: Insert Order
    DB-->>OS: Order ID
    OS->>PS: Process Payment
    PS->>DB: Record Transaction
    DB-->>PS: TX ID
    PS-->>OS: Payment Confirmed
    OS->>MQ: Publish OrderCreated
    MQ->>NS: Consume Event
    NS->>U: Email Confirmation
    OS-->>GW: Order Response
    GW-->>FE: 201 Created
    FE-->>U: Order Confirmation
```

## 3. Entity Relationship Diagram

```mermaid
erDiagram
    CUSTOMER ||--o{ ORDER : places
    CUSTOMER {
        int id PK
        string name
        string email
        string phone
        date created_at
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        int id PK
        int customer_id FK
        date order_date
        string status
        decimal total_amount
    }
    ORDER_ITEM }|--|| PRODUCT : references
    ORDER_ITEM {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
        decimal unit_price
    }
    PRODUCT ||--o{ INVENTORY : tracked_in
    PRODUCT {
        int id PK
        string name
        string description
        decimal price
        int category_id FK
    }
    CATEGORY ||--o{ PRODUCT : contains
    CATEGORY {
        int id PK
        string name
        string description
    }
    INVENTORY {
        int id PK
        int product_id FK
        int warehouse_id FK
        int quantity
        date last_updated
    }
    WAREHOUSE ||--o{ INVENTORY : stores
    WAREHOUSE {
        int id PK
        string name
        string location
        string manager
    }
```

## 4. Complex PlantUML Component Diagram

```plantuml
@startuml
skinparam componentStyle rectangle
skinparam backgroundColor transparent

package "Frontend Layer" {
    [React SPA] as FE
    [Mobile App] as MA
    [Admin Dashboard] as AD
}

package "API Gateway" {
    [Kong Gateway] as GW
    [Rate Limiter] as RL
    [Auth Middleware] as AM
}

package "Microservices" {
    [User Service] as US
    [Order Service] as OS
    [Product Service] as PS
    [Payment Service] as PAY
    [Notification Service] as NS
    [Search Service] as SS
    [Analytics Service] as AS
}

package "Data Layer" {
    database "PostgreSQL" as PG
    database "MongoDB" as MG
    database "Redis Cache" as RC
    database "Elasticsearch" as ES
}

package "Infrastructure" {
    [Message Queue\n(RabbitMQ)] as MQ
    [Object Storage\n(S3)] as S3
    [CDN\n(CloudFront)] as CDN
}

FE --> GW
MA --> GW
AD --> GW

GW --> RL
GW --> AM

AM --> US
GW --> OS
GW --> PS
GW --> PAY
GW --> SS

US --> PG
OS --> PG
PS --> MG
PAY --> PG
SS --> ES
AS --> MG

US --> RC
OS --> RC
PS --> RC

OS --> MQ
PAY --> MQ
MQ --> NS
MQ --> AS

PS --> S3
FE --> CDN
CDN --> S3

@enduml
```

## 5. Mermaid State Diagram

```mermaid
stateDiagram-v2
    [*] --> Draft
    Draft --> PendingReview: Submit
    PendingReview --> InReview: Assign Reviewer
    InReview --> ChangesRequested: Request Changes
    InReview --> Approved: Approve
    ChangesRequested --> Draft: Revise
    Approved --> Scheduled: Schedule Publication
    Scheduled --> Published: Publish
    Published --> Archived: Archive
    Published --> Draft: Unpublish & Edit
    Archived --> Draft: Restore
    Archived --> [*]: Delete

    state InReview {
        [*] --> TechnicalReview
        TechnicalReview --> EditorialReview: Tech OK
        TechnicalReview --> TechFeedback: Issues Found
        TechFeedback --> TechnicalReview: Addressed
        EditorialReview --> FinalCheck: Edit OK
        EditorialReview --> EditFeedback: Needs Work
        EditFeedback --> EditorialReview: Revised
        FinalCheck --> [*]: Complete
    }
```

## 6. Mermaid Gantt Chart

```mermaid
gantt
    title Project Development Timeline
    dateFormat  YYYY-MM-DD
    section Planning
    Requirements Gathering    :a1, 2025-01-01, 14d
    Architecture Design       :a2, after a1, 10d
    Tech Stack Selection      :a3, after a1, 5d
    section Backend
    API Design                :b1, after a2, 7d
    Database Schema           :b2, after a2, 5d
    Core Services             :b3, after b1, 21d
    Authentication            :b4, after b1, 10d
    Integration Tests         :b5, after b3, 7d
    section Frontend
    UI/UX Design              :c1, after a2, 14d
    Component Library         :c2, after c1, 10d
    Page Implementation       :c3, after c2, 21d
    E2E Tests                 :c4, after c3, 7d
    section DevOps
    CI/CD Pipeline            :d1, after a3, 7d
    Staging Environment       :d2, after d1, 5d
    Monitoring Setup          :d3, after d2, 5d
    section Release
    Beta Testing              :e1, after b5, 14d
    Bug Fixes                 :e2, after e1, 7d
    Production Deploy         :e3, after e2, 3d
    Post-launch Monitoring    :e4, after e3, 7d
```

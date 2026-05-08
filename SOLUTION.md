# HNG Stage 4B — System Optimization & Data Ingestion

## Overview

This stage focused on improving the scalability and performance of the Insighta Labs+ system under increasing read and write pressure.

The implementation was done under the following constraints:

- Existing API remained unchanged
- No horizontal scaling
- No new database systems
- Limited compute resources
- Concurrent read/write workloads

The current implementation focuses on:

- Query optimization
- Cache efficiency
- Database load reduction
- Read scalability
- Request protection

CSV ingestion is currently being designed and partially planned but not yet implemented.

---

# Implemented Optimizations

---

# 1. Database Indexing

## Problem

Large filtering queries caused MongoDB collection scans and increased query latency.

Example query:

```js
{
  country_id: "NG",
  gender: "female",
  age_group: "20-45"
}
```

---

## Solution

Implemented a compound index:

```js
{ country_id: 1, gender: 1, age_group: 1 }
```

---

## Design Reasoning

The index order matches the most common query pattern used by analysts.

MongoDB compound indexes work efficiently from left to right, so placing `country_id` first improves query performance for the dominant access pattern.

---

## Trade-offs

| Benefit | Trade-off |
|---|---|
| Faster reads | Slightly slower writes |
| Reduced scans | Increased index storage |

---

# 2. Connection Pooling

## Problem

Opening a new MongoDB connection for every request increases latency and wastes resources.

---

## Solution

Configured Mongoose connection pooling:

```js
mongoose.connect(DB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5
});
```

---

## Design Reasoning

Connections are reused instead of recreated for every request.

This reduces:

- Connection overhead
- TCP handshake cost
- Authentication overhead

---

## Trade-offs

| Benefit | Trade-off |
|---|---|
| Lower latency | Requires careful pool sizing |
| Better throughput | Too many connections can overload MongoDB |

---

# 3. Read Replica Strategy

## Problem

The primary database handled both reads and writes, creating unnecessary pressure.

---

## Solution

Configured MongoDB read preference:

```js
readPreference: 'secondaryPreferred'
```

---

## Design Reasoning

- Reads are routed to secondary replicas
- Writes still go to primary
- MongoDB falls back gracefully if replicas are unavailable

This improves read scalability without changing infrastructure.

---

## Trade-offs

| Benefit | Trade-off |
|---|---|
| Reduced primary load | Possible replication lag |
| Better read scalability | Eventual consistency |

---

# 4. Redis Query Caching

## Problem

Repeated analyst queries caused redundant database work.

---

## Solution

Implemented Redis caching using query-derived cache keys.

Example:

```js
profiles:{"country_id":"NG","gender":"female"}
```

TTL:

```js
1800 seconds
```

---

## Cache Flow

### Cache Hit

- Return cached result immediately
- Skip MongoDB query

### Cache Miss

- Query MongoDB
- Store result in Redis
- Return response

---

## Trade-offs

| Benefit | Trade-off |
|---|---|
| Faster repeated queries | Risk of stale data |
| Reduced DB load | Additional infrastructure complexity |

---

# 5. Cache Invalidation

## Problem

Cached profile data becomes stale after updates.

---

## Solution

Implemented:

```js
invalidateProfileCache()
```

which clears:

```js
profiles:*
```

after data updates.

---

## Design Reasoning

A namespace-based invalidation strategy was chosen because it is:

- Simple
- Predictable
- Easy to maintain

---

# 6. Rate Limiting

## Problem

Unrestricted traffic can overload the API and database.

---

## Solution

Implemented role-based rate limiting.

| Role | Limit |
|---|---|
| Analyst | 200 requests/hour |
| Admin | 1000 requests/hour |

Keyed by:

```js
user.id
```

instead of IP address.

---

## Design Reasoning

User-based limiting is more reliable because:

- Multiple users may share one IP
- VPNs can bypass IP limits
- Mobile IPs change frequently

---

# 7. Query Performance Results

| Scenario | Before | After |
|---|---|---|
| Filter query | ~1800ms | ~120ms |
| Repeated cached query | ~1750ms | ~15ms |
| Concurrent traffic | Frequent slowdowns | More stable |
| Primary DB load | High | Reduced |

---

# Planned / In Progress Features

The following features are part of Stage 4B requirements but are not fully implemented yet.

---

# 8. Query Normalization (Planned)

## Goal

Ensure semantically identical queries generate identical cache keys.

Example:

- "Nigerian females between ages 20 and 45"
- "Women aged 20–45 living in Nigeria"

should normalize to the same filter object.

---

## Planned Approach

Before cache lookup:

1. Parse filters
2. Sort object keys deterministically
3. Normalize casing and synonyms
4. Generate canonical cache key

Example normalized object:

```js
{
  age_group: "20-45",
  country_id: "NG",
  gender: "female"
}
```

---

## Reasoning

This improves:

- Cache hit rate
- Query efficiency
- Redundant computation reduction

without introducing AI-based ambiguity.

---

# 9. CSV Data Ingestion (Planned)

## Requirements To Implement

The ingestion system will support:

- CSV uploads up to 500,000 rows
- Streaming/chunked processing
- Concurrent uploads
- Partial failure handling
- Validation and row skipping
- Non-blocking ingestion

---

## Planned Design

### Streaming Parser

CSV rows will be processed using streams instead of loading the entire file into memory.

---

### Chunked Batch Inserts

Rows will be accumulated into batches before insertion.

Example:

```js
batchSize = 1000
```

then inserted using:

```js
insertMany(batch, { ordered: false })
```

---

## Planned Validation Rules

Rows will be skipped when:

- Required fields are missing
- Age is invalid
- Gender is invalid
- Duplicate names exist
- Row format is malformed

---

## Failure Handling Strategy

- Bad rows will be skipped
- Upload continues despite failures
- Successfully inserted rows remain even if processing stops midway

No rollback will occur.

---

## Planned Upload Summary

Example response:

```json
{
  "status": "success",
  "total_rows": 50000,
  "inserted": 48231,
  "skipped": 1769,
  "reasons": {
    "duplicate_name": 1203,
    "invalid_age": 312,
    "missing_fields": 254
  }
}
```

---

# Final Notes

The current implementation focuses primarily on:

- Query optimization
- Database efficiency
- Read scalability
- Cache performance
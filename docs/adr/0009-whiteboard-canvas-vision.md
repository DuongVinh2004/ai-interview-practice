# ADR 0009: Whiteboard Canvas Architecture & Multimodal Vision Analysis

## Status

Accepted

## Context

Feature F003 introduces interactive System Design interviews into the platform. Candidates need an intuitive, responsive whiteboard canvas to diagram distributed systems (architectural topology, microservices, caches, message queues, databases, load balancers). The platform needs to capture canvas snapshots, stream design state, and utilize multimodal AI vision models (such as GPT-4o / Gemini Pro Vision) to evaluate the system design across standard architectural dimensions (functional requirements, high-level architecture, component deep-dive, scalability & resilience, and data modeling).

## Decision

1. **Embedded Canvas Engine**: We employ a lightweight, vector-based interactive whiteboard canvas designed for system diagrams with rich predefined system component building blocks (Load Balancer, API Gateway, CDN, Message Broker, Cache, SQL/NoSQL Databases, Microservice).
2. **Snapshot & State Serialization**: Canvas state is serialized into JSON (`canvasStateJson`) alongside compressed image snapshots (PNG/SVG data URLs or object storage URLs) recorded at key turn intervals and upon candidate submission.
3. **Multimodal AI Provider Abstraction**:
   - `MultimodalProvider` interface decouples the vision analysis pipeline from underlying AI vendors (OpenAI GPT-4o Vision, Google Gemini Vision).
   - In CI, automated testing, and development environments, a deterministic `MockVisionProvider` generates rubric-aligned architectural evaluations with component detection, strengths, failure-point analysis, and recommendations without relying on third-party API quotas.
4. **5-Dimension Rubric Scoring**: System design submissions are evaluated across 5 core dimensions (0–10 scale each):
   - Requirements & Scope Formulation
   - High-Level Architectural Topology
   - Component & Service Decomposition
   - Scalability, Latency & Resilience Strategy
   - Data Modeling, Sharding & Storage Choice
5. **Real-Time AI Co-Pilot & Time-Lapse Playback**: The feedback panel supports streaming analysis and time-lapse replay of canvas evolution across interview checkpoints.

## Consequences

- **Positive**: High responsiveness, offline and testable AI vision pipeline, structured 5-axis objective rubric feedback, extensible to various canvas formats.
- **Negative**: Canvas snapshots require efficient client-side rendering and compression to minimize payload size during streaming analysis.

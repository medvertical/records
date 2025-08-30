---
description: Generate a PRD for an existing application by scanning its codebase
globs:
alwaysApply: false
---
# Rule: Reverse-Engineering a Product Requirements Document (PRD)

## Goal

To guide an AI assistant in creating a detailed Product Requirements Document (PRD) in Markdown format for an **existing application**, based on insights gathered from scanning the codebase. The PRD should clearly document the current purpose, functionality, and scope of the app so that new developers or stakeholders can quickly understand it.

## Process

1. **Scan Codebase:** Analyze the provided source code, configuration files, and documentation to infer the application's purpose, features, target users, and constraints.
2. **Ask Clarifying Questions (Optional):** If code alone leaves ambiguity (e.g., unclear business goals or incomplete modules), ask the user targeted questions to confirm assumptions.
3. **Generate PRD:** Based on findings, create a PRD in Markdown using the structure below.
4. **Save PRD:** Save the document as `prd-[app-name].md` inside the `/tasks` directory.

## Key Areas to Identify from Codebase

* **Problem/Goal:** What main problem or need does the app address?
* **Target User:** Who is the primary user (based on roles, permissions, or features)?
* **Core Functionality:** What are the main features implemented in the app? (Look for routes, services, controllers, UI screens, APIs, etc.)
* **User Stories (Inferred):** Based on functionality, what user journeys seem supported?
* **Acceptance Criteria:** What behaviors/outputs appear critical to mark the app as functioning correctly? (tests, validation rules, error handling)
* **Scope/Boundaries:** What is not included or intentionally excluded (e.g., missing integrations, stubs, TODOs)?
* **Data Model:** What kinds of entities/data structures exist? How are they used?
* **Design/UI:** Any clear UI patterns, frameworks, or components visible?
* **Technical Constraints:** Frameworks, third-party services, dependencies, or environment requirements.

## PRD Structure

The generated PRD should include:

1. **Introduction/Overview:** High-level description of the app’s purpose and audience.
2. **Goals:** The objectives the app seems built to achieve.
3. **User Stories (Inferred):** Narratives that match current features (e.g., “As a [user], I can [do X] so that [benefit]”).
4. **Functional Requirements (Observed):** List of existing features (numbered).
5. **Non-Goals / Out of Scope:** Explicitly state what’s not supported.
6. **Design Considerations:** Any existing UI/UX conventions.
7. **Technical Considerations:** Frameworks, dependencies, integrations, constraints.
8. **Success Metrics (Inferred):** Metrics implied (e.g., login success rate, order completion).
9. **Open Questions:** Areas requiring confirmation or where code does not provide clarity.

## Target Audience

Assume the PRD is for **new developers joining the project**. The PRD should help them quickly understand the product vision and functionality without digging through code.

### Quality Assessment: The Good, The Bad, and The Ugly
Add a  section to the PRD outlining what's good, what needs improvement, and notable risks/missing features. This is an opportunity to evaluate the code and to produce audit quality feedback.

## Output

* **Format:** Markdown (`.md`)
* **Location:** `/tasks/`
* **Filename:** `prd-[app-name].md`

## Final Instructions

1. Do NOT change or propose new features — only document what already exists.
2. If unsure, mark sections as “unclear” or list as open questions.
3. Strive for clarity, structure, and completeness based on available evidence.
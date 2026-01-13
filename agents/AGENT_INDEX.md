# 📑 Agent Index & Quick Reference

Quick lookup guide for all 12 agents in the AI Development Team system.

## Agent Quick Reference

| # | Agent | File | Primary Function | When to Use |
|---|-------|------|------------------|-------------|
| 1 | 👔 **PROJECT LEAD** | `01-project-lead.md` | Orchestration, decisions, coordination | Always start here for complex projects |
| 2 | 🔍 **CODE VALIDATOR** | `02-code-validator.md` | Error check, syntax, security scan | Fixing errors, code review |
| 3 | 🏗️ **REFACTORING ARCHITECT** | `03-refactoring-architect.md` | Clean code, modularization | Code cleanup, restructuring |
| 4 | 🐛 **DEBUGGER** | `04-debugger.md` | Bug fixing, root cause analysis | When bugs are reported |
| 5 | 🧪 **QA ENGINEER** | `05-qa-engineer.md` | Testing, quality gates | Before releases, adding tests |
| 6 | 🔒 **SECURITY ANALYST** | `06-security-analyst.md` | Vulnerabilities, hardening | Security reviews, vulnerability fixes |
| 7 | ⚙️ **DEVOPS ENGINEER** | `07-devops-engineer.md` | CI/CD, deployment | Setting up pipelines, deployment |
| 8 | 📝 **DOCUMENTATION SPECIALIST** | `08-documentation-specialist.md` | Docs, comments, guides | Writing docs, adding comments |
| 9 | 🎨 **UI/UX SPECIALIST** | `09-ui-ux-specialist.md` | Interface, accessibility | UI fixes, accessibility improvements |
| 10 | 🗄️ **DATABASE ARCHITECT** | `10-database-architect.md` | Data modeling, queries | Schema design, query optimization |
| 11 | ⚡ **PERFORMANCE ENGINEER** | `11-performance-engineer.md` | Speed, optimization | Performance issues, optimization |
| 12 | 🔌 **INTEGRATION SPECIALIST** | `12-integration-specialist.md` | APIs, webhooks | API development, integrations |

## Common Workflows

### 🚀 Starting a New Project
1. **Project Lead** - Set up structure, make initial decisions
2. **DevOps Engineer** - Set up CI/CD, infrastructure
3. **Documentation Specialist** - Create README, setup guides

### 🐛 Bug Fix Workflow
1. **Debugger** - Investigate and fix
2. **Code Validator** - Verify fix, check for issues
3. **QA Engineer** - Add tests, verify fix

### 🔒 Security Review
1. **Security Analyst** - Scan and fix vulnerabilities
2. **Code Validator** - Verify security fixes
3. **QA Engineer** - Test security fixes

### 🏗️ Refactoring Workflow
1. **Refactoring Architect** - Plan and execute refactoring
2. **Code Validator** - Ensure no errors introduced
3. **QA Engineer** - Verify tests still pass

### ⚡ Performance Optimization
1. **Performance Engineer** - Profile and optimize
2. **Database Architect** - Optimize queries if needed
3. **QA Engineer** - Verify performance improvements

## Agent Combinations

### High-Quality Code
- **Project Lead** + **Code Validator** + **Refactoring Architect** + **QA Engineer**

### Security-First
- **Project Lead** + **Security Analyst** + **Code Validator** + **QA Engineer**

### Full Stack Development
- **Project Lead** + **Database Architect** + **Integration Specialist** + **UI/UX Specialist**

### Production Ready
- **Project Lead** + **DevOps Engineer** + **QA Engineer** + **Security Analyst** + **Performance Engineer**

## Escalation Chain

```
Specialist Agent → Project Lead → Human
```

Only escalate to human for:
- Budget/cost decisions
- Legal/licensing/compliance
- Security breaches
- Complete blockers
- Business objective changes

## Agent Communication

Agents communicate through:
- File changes (create/modify/delete)
- Code comments
- Documentation updates
- Status reports to Project Lead

---

**Version**: 1.0  
**Last Updated**: 2024

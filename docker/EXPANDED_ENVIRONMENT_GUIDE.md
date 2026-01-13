# Expanded Docker Environment Guide

## Overview

This guide covers the expanded Docker testing environment with:
- **Primary Domain Controller** (DC01)
- **Backup Domain Controller** (DC02)
- **Client Workstation** (CLIENT01)
- **4 Member Servers** (FILESERVER01, APPSERVER01, WEBSERVER01, DBSERVER01)
- **40+ Users** across 8 departments
- **20+ Security Groups** including AppLocker groups

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│              applocker.local Domain                      │
│                                                          │
│  ┌──────────────┐         ┌──────────────┐            │
│  │  Primary DC  │ ◄─────► │  Backup DC   │            │
│  │    (DC01)    │         │    (DC02)    │            │
│  └──────────────┘         └──────────────┘            │
│         │                       │                      │
│         ├───────────────────────┼──────────────────┐ │
│         │                       │                  │ │
│  ┌──────▼──────┐         ┌──────▼──────┐          │ │
│  │  CLIENT01   │         │ FILESERVER01│          │ │
│  └─────────────┘         └─────────────┘          │ │
│                                               ┌───▼───┐│
│                                               │APPSVR ││
│                                               │  01   ││
│                                               └───────┘│
│                                               ┌───▼───┐│
│                                               │WEBSVR ││
│                                               │  01   ││
│                                               └───────┘│
│                                               ┌───▼───┐│
│                                               │DBSVR  ││
│                                               │  01   ││
│                                               └───────┘│
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Build and Start All Containers

```powershell
cd docker
.\run-expanded-tests.ps1 -All
```

This will:
- Build all containers
- Start them in the correct order
- Wait for services to initialize
- Run comprehensive tests
- Copy test results

### 2. Manual Steps

#### Build Containers

```powershell
docker-compose -f docker-compose.windows2019-expanded.yml build
```

#### Start Containers

```powershell
docker-compose -f docker-compose.windows2019-expanded.yml up -d
```

#### Wait for Services

```powershell
# Wait for primary DC (2 minutes)
Start-Sleep -Seconds 120

# Wait for backup DC (2 minutes)
Start-Sleep -Seconds 120

# Wait for member servers to join (2 minutes)
Start-Sleep -Seconds 120
```

#### Create Users and Groups

```powershell
# Users are created automatically, but you can run manually:
docker exec ga-applocker-dc-2019 powershell -File C:\scripts\create-users-and-groups.ps1
```

#### Run Tests

```powershell
# Comprehensive tests
docker exec ga-applocker-dc-2019 powershell -File C:\scripts\test-expanded-environment.ps1

# Or use the orchestration script
.\run-expanded-tests.ps1 -Test
```

## Environment Details

### Domain Controllers

#### Primary DC (DC01)
- **Container**: `ga-applocker-dc-2019`
- **Hostname**: DC01
- **Domain**: applocker.local
- **Ports**: 53, 88, 135, 389, 445, 464, 636, 3268, 3269
- **Role**: Creates domain, users, groups

#### Backup DC (DC02)
- **Container**: `ga-applocker-backup-dc-2019`
- **Hostname**: DC02
- **Domain**: applocker.local
- **Ports**: 5353, 8888 (mapped to avoid conflicts)
- **Role**: Replicates from primary DC, provides redundancy

### Member Servers

#### File Server (FILESERVER01)
- **Container**: `ga-applocker-member-01-2019`
- **Hostname**: FILESERVER01
- **Role**: File sharing, storage
- **WinRM**: Ports 5987, 5988

#### Application Server (APPSERVER01)
- **Container**: `ga-applocker-member-02-2019`
- **Hostname**: APPSERVER01
- **Role**: Application hosting
- **WinRM**: Ports 5989, 5990

#### Web Server (WEBSERVER01)
- **Container**: `ga-applocker-member-03-2019`
- **Hostname**: WEBSERVER01
- **Role**: Web services
- **WinRM**: Ports 5991, 5992

#### Database Server (DBSERVER01)
- **Container**: `ga-applocker-member-04-2019`
- **Hostname**: DBSERVER01
- **Role**: Database services
- **WinRM**: Ports 5993, 5994

### Client

#### Client Workstation (CLIENT01)
- **Container**: `ga-applocker-client-2019`
- **Hostname**: CLIENT01
- **Role**: End-user workstation, AppLocker testing
- **WinRM**: Ports 5985, 5986

## User and Group Structure

### Departments (8)

1. **IT** - IT Department
2. **Finance** - Finance Department
3. **HR** - Human Resources
4. **Engineering** - Engineering Department
5. **Sales** - Sales Department
6. **Marketing** - Marketing Department
7. **Operations** - Operations Department
8. **Security** - Security Department

### Users (40+)

- **5 users per department** = 40 users
- **3 service accounts** = 3 additional users
- **Total**: 43+ users

Each user has:
- Unique username (first initial + last name)
- Department assignment
- Role (Manager, Admin, or User)
- Group memberships based on department and role

### Security Groups (20+)

#### Department Groups
- `IT-Users`, `IT-Admins`, `IT-Managers`
- `Finance-Users`, `Finance-Managers`
- `HR-Users`, `HR-Managers`
- `Engineering-Users`, `Engineering-Developers`
- `Sales-Users`, `Sales-Managers`
- `Marketing-Users`, `Marketing-Managers`
- `Operations-Users`, `Operations-Managers`
- `Security-Users`, `Security-Admins`

#### AppLocker Groups
- `AppLocker-Users` - Standard users
- `AppLocker-Admins` - Administrators
- `AppLocker-Exe-Allow` - Allowed executables
- `AppLocker-Exe-Deny` - Denied executables
- `AppLocker-Script-Allow` - Allowed scripts
- `AppLocker-Script-Deny` - Denied scripts
- `AppLocker-MSI-Allow` - Allowed MSI installers
- `AppLocker-MSI-Deny` - Denied MSI installers

## Testing

### Test Coverage

The expanded environment tests cover:

1. **Domain Controller Tests**
   - Domain existence
   - DNS service
   - AD DS service
   - User creation
   - Group creation

2. **Backup DC Tests**
   - Domain controller status
   - Replication status
   - DNS resolution

3. **User and Group Tests**
   - Total user count (>= 40)
   - Department distribution
   - Security groups count (>= 20)
   - AppLocker groups
   - Group membership

4. **Organizational Unit Tests**
   - Department OUs
   - User placement

5. **Member Server Tests**
   - Connectivity
   - Domain join status
   - WinRM access

6. **Network Tests**
   - All servers reachable
   - DNS resolution

### Running Tests

#### Comprehensive Test Suite

```powershell
.\run-expanded-tests.ps1 -Test
```

#### Individual Container Tests

```powershell
# Test primary DC
docker exec ga-applocker-dc-2019 powershell -File C:\scripts\test-expanded-environment.ps1

# Test client
docker exec ga-applocker-client-2019 powershell -File C:\scripts\run-functionality-tests.ps1

# Test member server
docker exec ga-applocker-member-01-2019 powershell -File C:\scripts\run-functionality-tests.ps1
```

#### User Creation Only

```powershell
.\run-expanded-tests.ps1 -UsersOnly
```

### Test Results

Test results are saved to:
- `.\test-results-expanded\` (on host)
- `C:\test-results\` (in containers)

Results include:
- JSON test results
- HTML reports
- User export CSV
- Log files

## Port Mapping

| Service | Container | Host Port | Container Port |
|---------|-----------|-----------|----------------|
| DNS | Primary DC | 53 | 53 |
| LDAP | Primary DC | 389 | 389 |
| LDAPS | Primary DC | 636 | 636 |
| Global Catalog | Primary DC | 3268 | 3268 |
| DNS | Backup DC | 5353 | 53 |
| WinRM HTTP | Client | 5985 | 5985 |
| WinRM HTTPS | Client | 5986 | 5986 |
| WinRM HTTP | File Server | 5987 | 5985 |
| WinRM HTTPS | File Server | 5988 | 5986 |
| WinRM HTTP | App Server | 5989 | 5985 |
| WinRM HTTPS | App Server | 5990 | 5986 |
| WinRM HTTP | Web Server | 5991 | 5985 |
| WinRM HTTPS | Web Server | 5992 | 5986 |
| WinRM HTTP | DB Server | 5993 | 5985 |
| WinRM HTTPS | DB Server | 5994 | 5986 |

## Troubleshooting

### Containers Won't Start

```powershell
# Check logs
docker-compose -f docker-compose.windows2019-expanded.yml logs

# Check specific container
docker logs ga-applocker-dc-2019
```

### Domain Join Fails

```powershell
# Check primary DC logs
docker logs ga-applocker-dc-2019

# Verify DNS resolution
docker exec ga-applocker-member-01-2019 nslookup DC01

# Check domain controller connectivity
docker exec ga-applocker-member-01-2019 Test-Connection DC01
```

### Users Not Created

```powershell
# Check user creation script
docker exec ga-applocker-dc-2019 powershell -File C:\scripts\create-users-and-groups.ps1

# Verify users exist
docker exec ga-applocker-dc-2019 powershell "Get-ADUser -Filter * | Measure-Object | Select-Object Count"
```

### Backup DC Not Replicating

```powershell
# Check replication status
docker exec ga-applocker-backup-dc-2019 powershell "Get-ADReplicationPartnerMetadata -Target DC02"

# Verify connectivity
docker exec ga-applocker-backup-dc-2019 Test-Connection DC01
```

### Member Servers Not Joining Domain

```powershell
# Check member server logs
docker logs ga-applocker-member-01-2019

# Verify DNS configuration
docker exec ga-applocker-member-01-2019 powershell "Get-DnsClientServerAddress"

# Test domain controller connectivity
docker exec ga-applocker-member-01-2019 Test-Connection DC01
```

## Performance

- **Container startup**: ~2-3 minutes per container
- **Primary DC initialization**: ~2-3 minutes
- **Backup DC promotion**: ~3-4 minutes
- **User creation**: ~1-2 minutes
- **Member server domain join**: ~1-2 minutes each
- **Total environment setup**: ~15-20 minutes
- **Test execution**: ~2-5 minutes

## Cleanup

```powershell
# Stop and remove containers
docker-compose -f docker-compose.windows2019-expanded.yml down

# Remove volumes (WARNING: Deletes all data)
docker-compose -f docker-compose.windows2019-expanded.yml down -v

# Remove images
docker rmi ga-applocker-dc-windows2019 ga-applocker-backup-dc-windows2019 ga-applocker-client-windows2019 ga-applocker-member-windows2019
```

## Use Cases

### 1. AppLocker Policy Testing

Test AppLocker policies across multiple servers and user groups:

```powershell
# Create policy on primary DC
docker exec ga-applocker-dc-2019 powershell "New-AppLockerPolicy -RuleType Publisher -User Everyone"

# Test policy on member servers
docker exec ga-applocker-member-01-2019 powershell "Get-AppLockerPolicy -Effective"
```

### 2. Group Policy Testing

Test GPO application across different OUs:

```powershell
# Create GPO
docker exec ga-applocker-dc-2019 powershell "New-GPO -Name 'AppLocker-Policy'"

# Link to OU
docker exec ga-applocker-dc-2019 powershell "New-GPLink -Name 'AppLocker-Policy' -Target 'OU=IT,DC=applocker,DC=local'"
```

### 3. User Management Testing

Test user creation, modification, and group membership:

```powershell
# List users by department
docker exec ga-applocker-dc-2019 powershell "Get-ADUser -Filter 'Department -eq \"IT\"'"

# Add user to group
docker exec ga-applocker-dc-2019 powershell "Add-ADGroupMember -Identity 'AppLocker-Users' -Members 'jsmith'"
```

### 4. Replication Testing

Test AD replication between primary and backup DCs:

```powershell
# Force replication
docker exec ga-applocker-backup-dc-2019 powershell "Sync-ADObject -Object DC01 -Source DC01"
```

## Next Steps

1. **Customize Users**: Modify `create-users-and-groups.ps1` to add more users or groups
2. **Add More Servers**: Add additional member servers to `docker-compose.windows2019-expanded.yml`
3. **Create Test Policies**: Develop AppLocker policies for testing
4. **Automate Testing**: Integrate tests into CI/CD pipeline
5. **Monitor Performance**: Add performance monitoring and metrics collection

---

*Last Updated: 2024*

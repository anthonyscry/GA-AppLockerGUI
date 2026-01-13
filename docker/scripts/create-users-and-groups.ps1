# PowerShell script to create 40 users with different groups
# This script creates a realistic AD environment for testing

$ErrorActionPreference = "Stop"

Write-Host "=== Creating Users and Groups ===" -ForegroundColor Green

$DomainName = $env:DOMAIN_NAME ?? "applocker.local"
$DomainNetBIOS = $env:DOMAIN_NETBIOS ?? "APPLOCKER"

# Import AD module
Import-Module ActiveDirectory -ErrorAction SilentlyContinue

# Define organizational structure
$Departments = @(
    @{Name="IT"; OU="OU=IT,DC=applocker,DC=local"; Groups=@("IT-Users", "IT-Admins", "AppLocker-Users")},
    @{Name="Finance"; OU="OU=Finance,DC=applocker,DC=local"; Groups=@("Finance-Users", "Finance-Managers", "AppLocker-Users")},
    @{Name="HR"; OU="OU=HR,DC=applocker,DC=local"; Groups=@("HR-Users", "HR-Managers", "AppLocker-Users")},
    @{Name="Engineering"; OU="OU=Engineering,DC=applocker,DC=local"; Groups=@("Engineering-Users", "Engineering-Developers", "AppLocker-Users")},
    @{Name="Sales"; OU="OU=Sales,DC=applocker,DC=local"; Groups=@("Sales-Users", "Sales-Managers", "AppLocker-Users")},
    @{Name="Marketing"; OU="OU=Marketing,DC=applocker,DC=local"; Groups=@("Marketing-Users", "Marketing-Managers", "AppLocker-Users")},
    @{Name="Operations"; OU="OU=Operations,DC=applocker,DC=local"; Groups=@("Operations-Users", "Operations-Managers", "AppLocker-Users")},
    @{Name="Security"; OU="OU=Security,DC=applocker,DC=local"; Groups=@("Security-Users", "Security-Admins", "AppLocker-Admins")}
)

# Create OUs if they don't exist
Write-Host "Creating Organizational Units..." -ForegroundColor Yellow
foreach ($Dept in $Departments) {
    try {
        $OUPath = "OU=$($Dept.Name),DC=applocker,DC=local"
        $OUExists = Get-ADOrganizationalUnit -Filter "Name -eq '$($Dept.Name)'" -ErrorAction SilentlyContinue
        if (-not $OUExists) {
            New-ADOrganizationalUnit -Name $Dept.Name -Path "DC=applocker,DC=local" -ErrorAction SilentlyContinue
            Write-Host "Created OU: $($Dept.Name)" -ForegroundColor Green
        }
    } catch {
        Write-Host "OU $($Dept.Name) may already exist: $_" -ForegroundColor Yellow
    }
}

# Create security groups
Write-Host "Creating Security Groups..." -ForegroundColor Yellow
$AllGroups = @()
foreach ($Dept in $Departments) {
    $AllGroups += $Dept.Groups
}
$AllGroups = $AllGroups | Select-Object -Unique

# Add AppLocker specific groups
$AppLockerGroups = @(
    "AppLocker-Users",
    "AppLocker-Admins",
    "AppLocker-Exe-Allow",
    "AppLocker-Exe-Deny",
    "AppLocker-Script-Allow",
    "AppLocker-Script-Deny",
    "AppLocker-MSI-Allow",
    "AppLocker-MSI-Deny"
)
$AllGroups += $AppLockerGroups
$AllGroups = $AllGroups | Select-Object -Unique

foreach ($GroupName in $AllGroups) {
    try {
        $GroupExists = Get-ADGroup -Filter "Name -eq '$GroupName'" -ErrorAction SilentlyContinue
        if (-not $GroupExists) {
            New-ADGroup -Name $GroupName -GroupScope Global -GroupCategory Security -ErrorAction SilentlyContinue
            Write-Host "Created group: $GroupName" -ForegroundColor Green
        }
    } catch {
        Write-Host "Group $GroupName may already exist: $_" -ForegroundColor Yellow
    }
}

# Create 40 users distributed across departments
Write-Host "Creating 40 users..." -ForegroundColor Yellow
$UserCounter = 1
$UsersCreated = 0

foreach ($Dept in $Departments) {
    # Calculate users per department (distribute 40 users across 8 departments = 5 each)
    $UsersPerDept = 5
    
    for ($i = 1; $i -le $UsersPerDept; $i++) {
        $FirstName = @("John", "Jane", "Mike", "Sarah", "David", "Emily", "Chris", "Lisa", "Tom", "Amy")[$i % 10]
        $LastName = @("Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez")[$UserCounter % 10]
        $Username = "$($FirstName.Substring(0,1).ToLower())$($LastName.ToLower())"
        $DisplayName = "$FirstName $LastName"
        $Email = "$Username@$DomainName"
        
        # Determine role based on user number
        $Role = if ($i -eq 1) { "Manager" } elseif ($i -eq 2) { "Admin" } else { "User" }
        
        try {
            $UserExists = Get-ADUser -Filter "SamAccountName -eq '$Username'" -ErrorAction SilentlyContinue
            if (-not $UserExists) {
                $Password = ConvertTo-SecureString -String "Password123!" -AsPlainText -Force
                
                # Create user in appropriate OU
                $OUPath = "OU=$($Dept.Name),DC=applocker,DC=local"
                try {
                    New-ADUser `
                        -Name $DisplayName `
                        -SamAccountName $Username `
                        -UserPrincipalName $Email `
                        -DisplayName $DisplayName `
                        -GivenName $FirstName `
                        -Surname $LastName `
                        -EmailAddress $Email `
                        -Path $OUPath `
                        -AccountPassword $Password `
                        -Enabled $true `
                        -PasswordNeverExpires $true `
                        -Department $Dept.Name `
                        -Title $Role `
                        -ErrorAction Stop
                    
                    Write-Host "Created user: $Username ($DisplayName) in $($Dept.Name)" -ForegroundColor Green
                    $UsersCreated++
                    
                    # Add user to appropriate groups
                    $GroupsToAdd = @()
                    
                    # Add department groups
                    if ($Role -eq "Manager") {
                        $GroupsToAdd += "$($Dept.Name)-Managers"
                    } elseif ($Role -eq "Admin") {
                        $GroupsToAdd += "$($Dept.Name)-Admins"
                    }
                    $GroupsToAdd += "$($Dept.Name)-Users"
                    
                    # Add AppLocker groups based on department
                    if ($Dept.Name -eq "Security" -or $Role -eq "Admin") {
                        $GroupsToAdd += "AppLocker-Admins"
                    } else {
                        $GroupsToAdd += "AppLocker-Users"
                    }
                    
                    # Add to AppLocker allow groups (for testing)
                    if ($UserCounter % 2 -eq 0) {
                        $GroupsToAdd += "AppLocker-Exe-Allow"
                        $GroupsToAdd += "AppLocker-Script-Allow"
                    }
                    
                    # Add user to groups
                    foreach ($Group in $GroupsToAdd) {
                        try {
                            Add-ADGroupMember -Identity $Group -Members $Username -ErrorAction SilentlyContinue
                        } catch {
                            # Group might not exist or user already member
                        }
                    }
                    
                } catch {
                    Write-Host "Error creating user $Username: $_" -ForegroundColor Red
                }
            } else {
                Write-Host "User $Username already exists" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "Error checking user $Username: $_" -ForegroundColor Yellow
        }
        
        $UserCounter++
    }
}

# Create some service accounts
Write-Host "Creating service accounts..." -ForegroundColor Yellow
$ServiceAccounts = @(
    @{Name="svc-applocker"; Description="AppLocker Service Account"; Groups=@("AppLocker-Admins")},
    @{Name="svc-scan"; Description="Scanning Service Account"; Groups=@("AppLocker-Users")},
    @{Name="svc-backup"; Description="Backup Service Account"; Groups=@("AppLocker-Users")}
)

foreach ($SvcAccount in $ServiceAccounts) {
    try {
        $UserExists = Get-ADUser -Filter "SamAccountName -eq '$($SvcAccount.Name)'" -ErrorAction SilentlyContinue
        if (-not $UserExists) {
            $Password = ConvertTo-SecureString -String "ServiceAccount123!" -AsPlainText -Force
            New-ADUser `
                -Name $SvcAccount.Name `
                -SamAccountName $SvcAccount.Name `
                -UserPrincipalName "$($SvcAccount.Name)@$DomainName" `
                -Description $SvcAccount.Description `
                -AccountPassword $Password `
                -Enabled $true `
                -PasswordNeverExpires $true `
                -ErrorAction SilentlyContinue
            
            foreach ($Group in $SvcAccount.Groups) {
                try {
                    Add-ADGroupMember -Identity $Group -Members $SvcAccount.Name -ErrorAction SilentlyContinue
                } catch {}
            }
            
            Write-Host "Created service account: $($SvcAccount.Name)" -ForegroundColor Green
            $UsersCreated++
        }
    } catch {
        Write-Host "Service account $($SvcAccount.Name) may already exist: $_" -ForegroundColor Yellow
    }
}

Write-Host "`n=== User and Group Creation Complete ===" -ForegroundColor Green
Write-Host "Users created: $UsersCreated" -ForegroundColor Cyan
Write-Host "Groups created: $($AllGroups.Count)" -ForegroundColor Cyan
Write-Host "Departments: $($Departments.Count)" -ForegroundColor Cyan

# Export user list
$UserList = Get-ADUser -Filter * -Properties Department, Title, MemberOf | Select-Object SamAccountName, Name, Department, Title, @{Name="Groups"; Expression={($_.MemberOf | ForEach-Object { (Get-ADGroup $_).Name }) -join ", "}}
$UserList | Export-Csv -Path "C:\logs\users-export.csv" -NoTypeInformation -Encoding UTF8
Write-Host "User list exported to C:\logs\users-export.csv" -ForegroundColor Cyan

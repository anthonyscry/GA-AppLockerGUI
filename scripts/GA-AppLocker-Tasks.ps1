<#
.SYNOPSIS
    GA-AppLocker Dashboard - Complete Task Library

.DESCRIPTION
    This script contains all atomic tasks for the GA-AppLocker application.
    Each task is broken down into the smallest possible steps with plain
    language explanations of what each step does and why.

.VISION
    "Scan AD for hosts, then scan the hosts for artifacts related to AppLocker,
    for the app to ingest those artifacts seamlessly to automatically create
    rules based on the best practices and security playbook, then merge all
    rules from various by workstation, member server, or domain controller
    to create a policy and apply to those OUs in audit mode depending on phases."

.WORKFLOW
    1. DISCOVER  -> Find all computers in Active Directory
    2. SCAN      -> Collect software artifacts from those computers
    3. INGEST    -> Load artifacts into the application
    4. GENERATE  -> Create AppLocker rules from artifacts
    5. MERGE     -> Combine rules by machine type (Workstation/Server/DC)
    6. DEPLOY    -> Apply policies to OUs in Audit mode
    7. MONITOR   -> Watch for blocked/audited events
    8. ENFORCE   -> Move from Audit to Enforced mode

.NOTES
    Author: GA-ASI AppLocker Toolkit
    Each function is self-contained and can be called independently.
    All functions return hashtables with success/failure status.
#>

#region ============================================================
#region MODULE 1: DASHBOARD
#region ============================================================
# The Dashboard module shows an overview of the AppLocker environment.
# It displays statistics about events, machines, and policy health
# so administrators can quickly assess the current state.
#endregion

<#
.TASK 1.1: Get AppLocker Event Statistics
.PURPOSE
    Count how many applications were allowed, audited, or blocked.
    This tells us if AppLocker is working and how many issues exist.
.HOW IT WORKS
    1. We look at the Windows Event Log where AppLocker writes its entries
    2. Event ID 8002 = Application was ALLOWED (rule matched)
    3. Event ID 8003 = Application would be BLOCKED but we're in AUDIT mode
    4. Event ID 8004 = Application was actually BLOCKED
    5. We count each type and return the totals
#>
function Get-AppLockerEventStatistics {
    [CmdletBinding()]
    param()

    # STEP 1.1.1: Define the log name
    # AppLocker writes to a special log, not the regular Application log.
    # The log name has spaces so we store it in a variable to avoid issues.
    $logName = 'Microsoft-Windows-AppLocker/EXE and DLL'

    # STEP 1.1.2: Check if the log exists on this computer
    # If AppLocker isn't configured, the log won't exist.
    # We check first to avoid errors.
    $logExists = Get-WinEvent -ListLog $logName -ErrorAction SilentlyContinue

    # STEP 1.1.3: If log doesn't exist, return zeros
    # This means AppLocker probably isn't set up yet.
    # We return zeros instead of an error so the dashboard still works.
    if (-not $logExists) {
        return @{
            success = $true
            allowed = 0
            audit = 0
            blocked = 0
            message = 'AppLocker log not found - AppLocker may not be configured'
        }
    }

    # STEP 1.1.4: Query events from the log
    # We get the last 1000 events. Getting more takes too long.
    # This gives us a good sample of recent activity.
    $events = Get-WinEvent -LogName $logName -MaxEvents 1000 -ErrorAction SilentlyContinue

    # STEP 1.1.5: Count ALLOWED events (Event ID 8002)
    # These are applications that matched an Allow rule.
    # High numbers here are normal - it means apps are running.
    $allowed = ($events | Where-Object { $_.Id -eq 8002 }).Count

    # STEP 1.1.6: Count AUDIT events (Event ID 8003)
    # These are applications that WOULD be blocked if we weren't in Audit mode.
    # High numbers here mean we need to create more rules before enforcing.
    $audit = ($events | Where-Object { $_.Id -eq 8003 }).Count

    # STEP 1.1.7: Count BLOCKED events (Event ID 8004)
    # These are applications that were actually stopped from running.
    # In Audit mode, this should be zero. In Enforce mode, these are real blocks.
    $blocked = ($events | Where-Object { $_.Id -eq 8004 }).Count

    # STEP 1.1.8: Return the statistics
    # We return a hashtable so the caller can easily access each value.
    return @{
        success = $true
        allowed = $allowed
        audit = $audit
        blocked = $blocked
        total = $events.Count
    }
}

<#
.TASK 1.2: Get Machine Count from Active Directory
.PURPOSE
    Count how many computers are in AD so we know the scope of deployment.
    We also categorize by type (workstation vs server) for planning.
.HOW IT WORKS
    1. Connect to Active Directory using the AD PowerShell module
    2. Query all computer objects
    3. Look at the OperatingSystem property to categorize each one
    4. Return counts by category
#>
function Get-ADMachineCount {
    [CmdletBinding()]
    param()

    # STEP 1.2.1: Import the ActiveDirectory module
    # This module isn't loaded by default. We need it to talk to AD.
    # If it fails, we're probably not on a domain-joined machine or don't have RSAT installed.
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'ActiveDirectory module not available. Install RSAT or run on a domain controller.'
        }
    }

    # STEP 1.2.2: Query all computers from AD
    # Get-ADComputer retrieves computer objects from Active Directory.
    # The -Filter * means "give me everything" (no filtering).
    $computers = Get-ADComputer -Filter * -Properties OperatingSystem

    # STEP 1.2.3: Count the total number of computers
    # Measure-Object counts items in a collection.
    $total = ($computers | Measure-Object).Count

    # STEP 1.2.4: Count workstations (Windows 10, Windows 11, Windows 7, etc.)
    # Workstations typically have "Windows 10" or "Windows 11" in their OS name.
    # We use -like with wildcards (*) to match partial strings.
    $workstations = ($computers | Where-Object {
        $_.OperatingSystem -like '*Windows 10*' -or
        $_.OperatingSystem -like '*Windows 11*' -or
        $_.OperatingSystem -like '*Windows 7*' -or
        $_.OperatingSystem -like '*Windows 8*'
    }).Count

    # STEP 1.2.5: Count servers (Windows Server 2016, 2019, 2022, etc.)
    # Servers have "Server" in their OS name.
    $servers = ($computers | Where-Object {
        $_.OperatingSystem -like '*Server*'
    }).Count

    # STEP 1.2.6: Count domain controllers
    # DCs are a special type of server. We identify them by checking
    # if they're in the Domain Controllers OU.
    $domainControllers = ($computers | Where-Object {
        $_.DistinguishedName -like '*Domain Controllers*'
    }).Count

    # STEP 1.2.7: Return the counts
    return @{
        success = $true
        total = $total
        workstations = $workstations
        servers = $servers
        domainControllers = $domainControllers
    }
}

<#
.TASK 1.3: Get Policy Health Score
.PURPOSE
    Calculate a "health score" for AppLocker configuration.
    This tells us how complete our policy setup is.
.HOW IT WORKS
    1. Get the current AppLocker policy
    2. Check if rules exist for each category (EXE, MSI, Script, DLL)
    3. Award 25 points for each category that has rules
    4. A score of 100 means all categories are configured
#>
function Get-PolicyHealthScore {
    [CmdletBinding()]
    param()

    # STEP 1.3.1: Get the effective AppLocker policy
    # "Effective" means the policy that's actually being applied right now.
    # This combines local policy with any GPO-based policies.
    $policy = Get-AppLockerPolicy -Effective -ErrorAction SilentlyContinue

    # STEP 1.3.2: Check if we got a policy back
    # If no policy exists, AppLocker isn't configured at all.
    if ($null -eq $policy) {
        return @{
            success = $true
            score = 0
            hasPolicy = $false
            message = 'No AppLocker policy is configured'
        }
    }

    # STEP 1.3.3: Check for EXE rules
    # EXE rules control which programs can run. This is the most important category.
    $hasExe = ($policy.RuleCollections | Where-Object {
        $_.RuleCollectionType -eq 'Exe' -and $_.Count -gt 0
    }).Count -gt 0

    # STEP 1.3.4: Check for MSI rules
    # MSI rules control which installers can run. Important for controlling software installation.
    $hasMsi = ($policy.RuleCollections | Where-Object {
        $_.RuleCollectionType -eq 'Msi' -and $_.Count -gt 0
    }).Count -gt 0

    # STEP 1.3.5: Check for Script rules
    # Script rules control PowerShell, batch files, VBScript, etc.
    $hasScript = ($policy.RuleCollections | Where-Object {
        $_.RuleCollectionType -eq 'Script' -and $_.Count -gt 0
    }).Count -gt 0

    # STEP 1.3.6: Check for DLL rules
    # DLL rules are advanced - they control which libraries programs can load.
    # Usually only enabled in high-security environments because it impacts performance.
    $hasDll = ($policy.RuleCollections | Where-Object {
        $_.RuleCollectionType -eq 'Dll' -and $_.Count -gt 0
    }).Count -gt 0

    # STEP 1.3.7: Calculate the score
    # Each category is worth 25 points. A complete setup scores 100.
    $score = 0
    if ($hasExe) { $score += 25 }
    if ($hasMsi) { $score += 25 }
    if ($hasScript) { $score += 25 }
    if ($hasDll) { $score += 25 }

    # STEP 1.3.8: Return the health result
    return @{
        success = $true
        score = $score
        hasPolicy = $true
        hasExe = $hasExe
        hasMsi = $hasMsi
        hasScript = $hasScript
        hasDll = $hasDll
    }
}

#region ============================================================
#region MODULE 2: REMOTE SCAN - DISCOVERY
#region ============================================================
# The Remote Scan module discovers machines in AD and scans them
# for software artifacts. This is the foundation of the vision:
# "Scan AD for hosts, then scan the hosts for artifacts"
#endregion

<#
.TASK 2.1: Get All AD Computers
.PURPOSE
    Retrieve a list of all computers from Active Directory.
    This is step 1 of the vision: "Scan AD for hosts"
.HOW IT WORKS
    1. Connect to Active Directory
    2. Query all computer objects
    3. Extract useful properties (name, OS, last login, OU)
    4. Return a structured list we can use for scanning
#>
function Get-AllADComputers {
    [CmdletBinding()]
    param(
        # Optional: limit results for testing
        [int]$MaxResults = 200
    )

    # STEP 2.1.1: Import the ActiveDirectory module
    # We need this module to query AD. It provides Get-ADComputer.
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'Failed to load ActiveDirectory module'
            data = @()
        }
    }

    # STEP 2.1.2: Define which properties we want to retrieve
    # By default, Get-ADComputer only returns basic info.
    # We need to explicitly request additional properties.
    $properties = @(
        'OperatingSystem',      # What OS is installed (Windows 10, Server 2019, etc.)
        'LastLogonDate',        # When did this computer last contact AD?
        'DistinguishedName',    # Full AD path (tells us which OU it's in)
        'Description'           # Admin-provided description
    )

    # STEP 2.1.3: Query AD for all computers
    # -Filter * means no filtering (get everything)
    # -Properties loads our extra properties
    $computers = Get-ADComputer -Filter * -Properties $properties |
        Select-Object -First $MaxResults

    # STEP 2.1.4: Check if we got any results
    if ($null -eq $computers -or @($computers).Count -eq 0) {
        return @{
            success = $true
            data = @()
            message = 'No computers found in Active Directory'
        }
    }

    # STEP 2.1.5: Initialize an array to hold our results
    # We'll build a clean list with just the data we need.
    $results = @()

    # STEP 2.1.6: Loop through each computer and extract data
    foreach ($computer in $computers) {

        # STEP 2.1.7: Get the hostname (computer name)
        # This is what we'll use to connect to the machine later.
        $hostname = $computer.Name

        # STEP 2.1.8: Get the operating system
        # This tells us if it's a workstation or server.
        $os = $computer.OperatingSystem

        # STEP 2.1.9: Get the last logon date
        # If this is very old, the computer might be decommissioned.
        $lastLogon = $computer.LastLogonDate

        # STEP 2.1.10: Extract the OU from the Distinguished Name
        # The DN looks like: CN=PC001,OU=Workstations,OU=Computers,DC=corp,DC=com
        # We want everything after the first comma (the OU path).
        $dn = $computer.DistinguishedName
        $ou = ($dn -split ',', 2)[1]  # Split on first comma, take second part

        # STEP 2.1.11: Determine if the computer is likely online
        # If it logged in within the last 30 days, assume it's active.
        $isActive = $false
        if ($lastLogon -and $lastLogon -gt (Get-Date).AddDays(-30)) {
            $isActive = $true
        }

        # STEP 2.1.12: Create a clean object with our data
        $obj = @{
            hostname = $hostname
            os = $os
            lastLogon = if ($lastLogon) { $lastLogon.ToString('yyyy-MM-dd') } else { 'Never' }
            ou = $ou
            isActive = $isActive
            description = $computer.Description
        }

        # STEP 2.1.13: Add to our results
        $results += $obj
    }

    # STEP 2.1.14: Return the computer list
    return @{
        success = $true
        data = $results
        count = $results.Count
    }
}

<#
.TASK 2.2: Filter Computers by OU
.PURPOSE
    Get only computers from a specific Organizational Unit.
    This lets us deploy policies to one OU at a time.
.HOW IT WORKS
    1. Validate the OU path exists
    2. Query only computers within that OU
    3. Return the filtered list
#>
function Get-ComputersByOU {
    [CmdletBinding()]
    param(
        # The Distinguished Name of the OU to search
        # Example: "OU=Workstations,DC=corp,DC=com"
        [Parameter(Mandatory = $true)]
        [string]$OUPath
    )

    # STEP 2.2.1: Validate the OU path isn't empty
    if ([string]::IsNullOrWhiteSpace($OUPath)) {
        return @{
            success = $false
            error = 'OU path is required'
            data = @()
        }
    }

    # STEP 2.2.2: Import the ActiveDirectory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'Failed to load ActiveDirectory module'
            data = @()
        }
    }

    # STEP 2.2.3: Verify the OU exists in AD
    # If someone types a wrong path, we want to tell them.
    $ouExists = Get-ADOrganizationalUnit -Filter "DistinguishedName -eq '$OUPath'" -ErrorAction SilentlyContinue
    if (-not $ouExists) {
        return @{
            success = $false
            error = "OU not found: $OUPath"
            data = @()
        }
    }

    # STEP 2.2.4: Query computers in the specified OU
    # -SearchBase limits the search to start at our OU
    # -SearchScope Subtree includes nested OUs
    $computers = Get-ADComputer -SearchBase $OUPath -SearchScope Subtree -Filter * `
        -Properties OperatingSystem, LastLogonDate

    # STEP 2.2.5: Convert to our standard format
    $results = @()
    foreach ($computer in $computers) {
        $results += @{
            hostname = $computer.Name
            os = $computer.OperatingSystem
            lastLogon = if ($computer.LastLogonDate) { $computer.LastLogonDate.ToString('yyyy-MM-dd') } else { 'Never' }
        }
    }

    # STEP 2.2.6: Return filtered results
    return @{
        success = $true
        data = $results
        count = $results.Count
        ou = $OUPath
    }
}

<#
.TASK 2.3: Check if Computer is Online
.PURPOSE
    Verify a computer is reachable before trying to scan it.
    This saves time by skipping offline machines.
.HOW IT WORKS
    1. Send a single ping (ICMP echo) to the computer
    2. If it responds, the computer is online
    3. Return true/false
#>
function Test-ComputerOnline {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComputerName
    )

    # STEP 2.3.1: Validate the computer name isn't empty
    if ([string]::IsNullOrWhiteSpace($ComputerName)) {
        return @{
            success = $false
            online = $false
            error = 'Computer name is required'
        }
    }

    # STEP 2.3.2: Send a single ping to the computer
    # -Count 1 means just one ping (faster than default 4)
    # -Quiet returns just true/false instead of detailed results
    # -ErrorAction SilentlyContinue prevents errors from showing
    $pingResult = Test-Connection -ComputerName $ComputerName -Count 1 -Quiet -ErrorAction SilentlyContinue

    # STEP 2.3.3: Return the result
    return @{
        success = $true
        computerName = $ComputerName
        online = $pingResult
    }
}

#region ============================================================
#region MODULE 2: REMOTE SCAN - ARTIFACT COLLECTION
#region ============================================================
# This section scans computers for software artifacts.
# This is the second part of the vision: "scan the hosts for artifacts"
#endregion

<#
.TASK 2.4: Scan Local Path for Executables
.PURPOSE
    Find all EXE files in a folder and collect information about them.
    This data becomes the basis for AppLocker rules.
.HOW IT WORKS
    1. Search the specified folder (and subfolders) for .exe files
    2. For each file, get:
       - File name and path
       - SHA256 hash (for hash-based rules)
       - Publisher signature (for publisher-based rules)
       - Version number
    3. Return a list of all artifacts found
#>
function Get-ExecutableArtifacts {
    [CmdletBinding()]
    param(
        # The folder to scan (defaults to Program Files)
        [string]$TargetPath = 'C:\Program Files',

        # Maximum files to process (prevent runaway scans)
        [int]$MaxFiles = 500
    )

    # STEP 2.4.1: Verify the target path exists
    if (-not (Test-Path $TargetPath)) {
        return @{
            success = $false
            error = "Path not found: $TargetPath"
            data = @()
        }
    }

    # STEP 2.4.2: Find all .exe files in the folder
    # -Recurse looks in all subfolders too
    # -Include *.exe filters to only executable files
    # -ErrorAction SilentlyContinue skips folders we can't access
    $files = Get-ChildItem -Path $TargetPath -Recurse -Include *.exe -ErrorAction SilentlyContinue |
        Select-Object -First $MaxFiles

    # STEP 2.4.3: Check if we found any files
    if (-not $files -or $files.Count -eq 0) {
        return @{
            success = $true
            data = @()
            message = "No executables found in $TargetPath"
        }
    }

    # STEP 2.4.4: Initialize results array
    $results = @()

    # STEP 2.4.5: Process each file
    foreach ($file in $files) {

        # STEP 2.4.6: Get the full file path
        $filePath = $file.FullName

        # STEP 2.4.7: Get the file name (without path)
        $fileName = $file.Name

        # STEP 2.4.8: Calculate the SHA256 hash
        # The hash uniquely identifies this exact file.
        # If the file changes by even one byte, the hash changes.
        $hashResult = Get-FileHash -Path $filePath -Algorithm SHA256 -ErrorAction SilentlyContinue
        $hash = if ($hashResult) { $hashResult.Hash } else { '' }

        # STEP 2.4.9: Get the digital signature (authenticode)
        # Signed files have a certificate from the publisher.
        # This lets us create rules that trust "all software from Microsoft"
        $signature = Get-AuthenticodeSignature -FilePath $filePath -ErrorAction SilentlyContinue

        # STEP 2.4.10: Extract publisher name from certificate
        # The certificate Subject contains CN=Publisher Name
        $publisher = 'Unknown'
        if ($signature -and $signature.SignerCertificate) {
            $subject = $signature.SignerCertificate.Subject
            # Extract just the CN (Common Name) part
            if ($subject -match 'CN=([^,]+)') {
                $publisher = $matches[1]
            }
            else {
                $publisher = $subject
            }
        }

        # STEP 2.4.11: Get file version from the EXE properties
        $version = $file.VersionInfo.FileVersion

        # STEP 2.4.12: Determine signature status
        # Valid = signed and trusted
        # NotSigned = no signature
        # Other statuses indicate problems
        $signatureStatus = if ($signature) { $signature.Status.ToString() } else { 'Unknown' }

        # STEP 2.4.13: Create the artifact object
        $artifact = @{
            name = $fileName
            path = $filePath
            hash = $hash
            publisher = $publisher
            version = $version
            signatureStatus = $signatureStatus
            size = $file.Length
        }

        # STEP 2.4.14: Add to results
        $results += $artifact
    }

    # STEP 2.4.15: Return all artifacts found
    return @{
        success = $true
        data = $results
        count = $results.Count
        scannedPath = $TargetPath
    }
}

<#
.TASK 2.5: Scan Remote Computer via WinRM
.PURPOSE
    Run the artifact scan on a remote computer.
    This lets us collect data from many computers centrally.
.HOW IT WORKS
    1. Connect to the remote computer using WinRM (Windows Remote Management)
    2. Run our scanning script on that computer
    3. Send the results back to us
.PREREQUISITES
    - WinRM must be enabled on the target computer
    - You must have admin rights on the target
    - Firewall must allow WinRM (port 5985 or 5986)
#>
function Get-RemoteArtifacts {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComputerName,

        # Optional credentials (uses current user if not provided)
        [PSCredential]$Credential
    )

    # STEP 2.5.1: Validate computer name
    if ([string]::IsNullOrWhiteSpace($ComputerName)) {
        return @{
            success = $false
            error = 'Computer name is required'
            data = @()
        }
    }

    # STEP 2.5.2: Test if the computer is online first
    $online = Test-Connection -ComputerName $ComputerName -Count 1 -Quiet -ErrorAction SilentlyContinue
    if (-not $online) {
        return @{
            success = $false
            error = "Computer '$ComputerName' is not reachable"
            data = @()
        }
    }

    # STEP 2.5.3: Test if WinRM is working
    # Test-WSMan checks if we can establish a WinRM connection
    $winrmTest = Test-WSMan -ComputerName $ComputerName -ErrorAction SilentlyContinue
    if (-not $winrmTest) {
        return @{
            success = $false
            error = "WinRM is not available on '$ComputerName'. Run Enable-PSRemoting on the target."
            data = @()
        }
    }

    # STEP 2.5.4: Define the script to run remotely
    # This script block will execute on the remote computer.
    # It scans for executables and returns the results.
    $scanScript = {
        $results = @()

        # Scan Program Files
        $paths = @(
            'C:\Program Files',
            'C:\Program Files (x86)',
            'C:\Windows\System32'
        )

        foreach ($path in $paths) {
            if (Test-Path $path) {
                $files = Get-ChildItem -Path $path -Recurse -Include *.exe -ErrorAction SilentlyContinue |
                    Select-Object -First 100

                foreach ($file in $files) {
                    $sig = Get-AuthenticodeSignature -FilePath $file.FullName -ErrorAction SilentlyContinue
                    $publisher = 'Unknown'
                    if ($sig.SignerCertificate.Subject -match 'CN=([^,]+)') {
                        $publisher = $matches[1]
                    }

                    $results += @{
                        name = $file.Name
                        path = $file.FullName
                        publisher = $publisher
                    }
                }
            }
        }

        return $results
    }

    # STEP 2.5.5: Execute the script remotely
    try {
        if ($Credential) {
            # Use provided credentials
            $remoteResults = Invoke-Command -ComputerName $ComputerName -Credential $Credential -ScriptBlock $scanScript -ErrorAction Stop
        }
        else {
            # Use current user's credentials
            $remoteResults = Invoke-Command -ComputerName $ComputerName -ScriptBlock $scanScript -ErrorAction Stop
        }
    }
    catch {
        return @{
            success = $false
            error = "Failed to execute remote scan: $($_.Exception.Message)"
            data = @()
        }
    }

    # STEP 2.5.6: Return the remote scan results
    return @{
        success = $true
        data = $remoteResults
        count = $remoteResults.Count
        computerName = $ComputerName
    }
}

<#
.TASK 2.6: Export Scan Results to CSV
.PURPOSE
    Save scan results to a file for later use.
    CSV format is easy to open in Excel and import later.
.HOW IT WORKS
    1. Take the artifact array
    2. Create the output folder if needed
    3. Write to CSV format
#>
function Export-ScanResults {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [array]$Artifacts,

        [Parameter(Mandatory = $true)]
        [string]$OutputPath
    )

    # STEP 2.6.1: Validate we have artifacts to export
    if (-not $Artifacts -or $Artifacts.Count -eq 0) {
        return @{
            success = $false
            error = 'No artifacts to export'
        }
    }

    # STEP 2.6.2: Validate output path was provided
    if ([string]::IsNullOrWhiteSpace($OutputPath)) {
        return @{
            success = $false
            error = 'Output path is required'
        }
    }

    # STEP 2.6.3: Get the parent directory from the path
    # If user gives us "C:\AppLocker\scan.csv", parent is "C:\AppLocker"
    $parentDir = Split-Path -Path $OutputPath -Parent

    # STEP 2.6.4: Create the directory if it doesn't exist
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # STEP 2.6.5: Export to CSV
    # Export-Csv writes each object as a row
    # -NoTypeInformation removes the #TYPE header line
    $Artifacts | Export-Csv -Path $OutputPath -NoTypeInformation -Force

    # STEP 2.6.6: Verify the file was created
    $fileExists = Test-Path $OutputPath

    # STEP 2.6.7: Return result
    return @{
        success = $fileExists
        path = $OutputPath
        count = $Artifacts.Count
    }
}

#region ============================================================
#region MODULE 3: RULE GENERATOR
#region ============================================================
# The Rule Generator creates AppLocker rules from artifacts.
# This is the third part of the vision: "automatically create rules"
# based on best practices and security playbook.
#endregion

<#
.TASK 3.1: Load Artifacts from CSV File
.PURPOSE
    Read previously saved scan results back into memory.
    This lets us create rules from saved scans.
.HOW IT WORKS
    1. Check if the file exists
    2. Use Import-Csv to read the data
    3. Convert to our standard format
#>
function Import-ArtifactsFromCSV {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$CsvPath
    )

    # STEP 3.1.1: Check if the file exists
    if (-not (Test-Path $CsvPath)) {
        return @{
            success = $false
            error = "File not found: $CsvPath"
            data = @()
        }
    }

    # STEP 3.1.2: Import the CSV file
    # Import-Csv reads CSV and creates objects with properties from headers
    try {
        $data = Import-Csv -Path $CsvPath -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = "Failed to read CSV: $($_.Exception.Message)"
            data = @()
        }
    }

    # STEP 3.1.3: Validate we got data
    if (-not $data -or $data.Count -eq 0) {
        return @{
            success = $false
            error = 'CSV file is empty'
            data = @()
        }
    }

    # STEP 3.1.4: Convert to standard format
    # CSV property names might vary, so we normalize them
    $artifacts = @()
    foreach ($row in $data) {
        $artifacts += @{
            name = $row.Name -or $row.name
            path = $row.Path -or $row.path
            publisher = $row.Publisher -or $row.publisher
            hash = $row.Hash -or $row.hash
            version = $row.Version -or $row.version
        }
    }

    # STEP 3.1.5: Return loaded artifacts
    return @{
        success = $true
        data = $artifacts
        count = $artifacts.Count
        source = $CsvPath
    }
}

<#
.TASK 3.2: Get Trusted Publishers from Certificate Store
.PURPOSE
    Find publishers already trusted by Windows.
    These are good candidates for Allow rules.
.HOW IT WORKS
    1. Look in the Windows certificate store
    2. The TrustedPublisher store contains explicitly trusted software publishers
    3. Extract the publisher names from certificates
#>
function Get-TrustedPublishers {
    [CmdletBinding()]
    param()

    # STEP 3.2.1: Define the certificate store path
    # LocalMachine\TrustedPublisher contains certificates for trusted software publishers
    $storePath = 'Cert:\LocalMachine\TrustedPublisher'

    # STEP 3.2.2: Check if the store exists and is accessible
    if (-not (Test-Path $storePath)) {
        return @{
            success = $true
            data = @()
            message = 'TrustedPublisher store not found or empty'
        }
    }

    # STEP 3.2.3: Get all certificates from the store
    $certs = Get-ChildItem -Path $storePath -ErrorAction SilentlyContinue

    # STEP 3.2.4: Initialize results array
    $publishers = @()

    # STEP 3.2.5: Process each certificate
    foreach ($cert in $certs) {

        # STEP 3.2.6: Get the Subject field
        # This contains CN=Publisher Name, O=Organization, etc.
        $subject = $cert.Subject

        # STEP 3.2.7: Extract the Common Name (CN)
        # The CN is the actual publisher name we want
        $publisherName = $subject
        if ($subject -match 'CN=([^,]+)') {
            $publisherName = $matches[1]
        }

        # STEP 3.2.8: Get the certificate thumbprint
        # This uniquely identifies the certificate
        $thumbprint = $cert.Thumbprint

        # STEP 3.2.9: Get expiration date
        # Expired certificates shouldn't be trusted
        $expiry = $cert.NotAfter

        # STEP 3.2.10: Check if certificate is still valid
        $isValid = $expiry -gt (Get-Date)

        # STEP 3.2.11: Create publisher object
        $pub = @{
            name = $publisherName
            thumbprint = $thumbprint
            expiry = $expiry.ToString('yyyy-MM-dd')
            isValid = $isValid
            subject = $subject
        }

        # STEP 3.2.12: Add to results
        $publishers += $pub
    }

    # STEP 3.2.13: Return the publisher list
    return @{
        success = $true
        data = $publishers
        count = $publishers.Count
    }
}

<#
.TASK 3.3: Generate Publisher Rule XML
.PURPOSE
    Create an AppLocker rule that allows/denies software from a specific publisher.
    Publisher rules are the most flexible - they trust ALL software from that publisher.
.HOW IT WORKS
    1. Take the publisher name, action (Allow/Deny), and target group
    2. Build the XML structure AppLocker expects
    3. The rule will match any file signed by this publisher
#>
function New-PublisherRule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$PublisherName,

        [ValidateSet('Allow', 'Deny')]
        [string]$Action = 'Allow',

        [string]$TargetGroup = 'Everyone',

        [string]$Description = ''
    )

    # STEP 3.3.1: Validate publisher name
    if ([string]::IsNullOrWhiteSpace($PublisherName)) {
        return @{
            success = $false
            error = 'Publisher name is required'
        }
    }

    # STEP 3.3.2: Validate action is Allow or Deny
    if ($Action -notin @('Allow', 'Deny')) {
        $Action = 'Allow'
    }

    # STEP 3.3.3: Generate a unique ID for this rule
    # Each rule needs a GUID to identify it
    $ruleId = [guid]::NewGuid().ToString()

    # STEP 3.3.4: Escape special XML characters in publisher name
    # Characters like & < > would break the XML
    $escapedPublisher = $PublisherName `
        -replace '&', '&amp;' `
        -replace '<', '&lt;' `
        -replace '>', '&gt;' `
        -replace '"', '&quot;'

    # STEP 3.3.5: Build a descriptive rule name
    $ruleName = "$Action - $PublisherName"

    # STEP 3.3.6: Build the XML structure
    # FilePublisherRule matches files based on their digital signature
    # PublisherName = The signer's name from the certificate
    # ProductName = * means any product from this publisher
    # BinaryName = * means any filename
    # BinaryVersionRange = * means any version
    $xml = @"
<FilePublisherRule Id="$ruleId" Name="$ruleName" Description="$Description" UserOrGroupSid="S-1-1-0" Action="$Action">
  <Conditions>
    <FilePublisherCondition PublisherName="$escapedPublisher" ProductName="*" BinaryName="*">
      <BinaryVersionRange LowSection="*" HighSection="*" />
    </FilePublisherCondition>
  </Conditions>
</FilePublisherRule>
"@

    # STEP 3.3.7: Return the rule
    return @{
        success = $true
        id = $ruleId
        name = $ruleName
        type = 'Publisher'
        action = $Action
        publisher = $PublisherName
        xml = $xml
    }
}

<#
.TASK 3.4: Generate Path Rule XML
.PURPOSE
    Create an AppLocker rule that allows/denies files at a specific path.
    Path rules are simple but less secure than publisher rules.
.HOW IT WORKS
    1. Take the file path and action
    2. Build the XML structure
    3. The rule will match any file at this exact path (or path pattern)
#>
function New-PathRule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [ValidateSet('Allow', 'Deny')]
        [string]$Action = 'Allow',

        [string]$Description = ''
    )

    # STEP 3.4.1: Validate path
    if ([string]::IsNullOrWhiteSpace($Path)) {
        return @{
            success = $false
            error = 'Path is required'
        }
    }

    # STEP 3.4.2: Validate action
    if ($Action -notin @('Allow', 'Deny')) {
        $Action = 'Allow'
    }

    # STEP 3.4.3: Generate unique rule ID
    $ruleId = [guid]::NewGuid().ToString()

    # STEP 3.4.4: Escape special XML characters in path
    $escapedPath = $Path `
        -replace '&', '&amp;' `
        -replace '<', '&lt;' `
        -replace '>', '&gt;' `
        -replace '"', '&quot;'

    # STEP 3.4.5: Build rule name from the filename
    $fileName = Split-Path -Path $Path -Leaf
    $ruleName = "$Action - $fileName"

    # STEP 3.4.6: Build the XML structure
    # FilePathRule matches based on file location
    # Path can include wildcards: * matches any characters
    # Example: C:\Program Files\* matches everything in Program Files
    $xml = @"
<FilePathRule Id="$ruleId" Name="$ruleName" Description="$Description" UserOrGroupSid="S-1-1-0" Action="$Action">
  <Conditions>
    <FilePathCondition Path="$escapedPath" />
  </Conditions>
</FilePathRule>
"@

    # STEP 3.4.7: Return the rule
    return @{
        success = $true
        id = $ruleId
        name = $ruleName
        type = 'Path'
        action = $Action
        path = $Path
        xml = $xml
    }
}

<#
.TASK 3.5: Generate Hash Rule XML
.PURPOSE
    Create an AppLocker rule that allows/denies a specific file based on its hash.
    Hash rules are the most secure but require updating when files change.
.HOW IT WORKS
    1. Calculate the SHA256 hash of the file
    2. Build the XML with the hash value
    3. Only this EXACT file (byte-for-byte) will match
#>
function New-HashRule {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,

        [ValidateSet('Allow', 'Deny')]
        [string]$Action = 'Allow',

        [string]$Description = ''
    )

    # STEP 3.5.1: Validate file exists
    if (-not (Test-Path $FilePath)) {
        return @{
            success = $false
            error = "File not found: $FilePath"
        }
    }

    # STEP 3.5.2: Calculate the SHA256 hash
    # This creates a unique fingerprint of the file's contents
    $hashResult = Get-FileHash -Path $FilePath -Algorithm SHA256
    $hash = $hashResult.Hash

    # STEP 3.5.3: Get the file name
    $fileName = Split-Path -Path $FilePath -Leaf

    # STEP 3.5.4: Get the file size in bytes
    # AppLocker stores this as additional verification
    $fileSize = (Get-Item $FilePath).Length

    # STEP 3.5.5: Generate unique rule ID
    $ruleId = [guid]::NewGuid().ToString()

    # STEP 3.5.6: Build rule name
    $ruleName = "$Action - $fileName (Hash)"

    # STEP 3.5.7: Build the XML structure
    # FileHashRule matches based on file content hash
    # Type = Hash algorithm (SHA256 is most common now)
    # Data = The actual hash value
    # SourceFileName = Original filename (for reference)
    # SourceFileLength = File size (additional check)
    $xml = @"
<FileHashRule Id="$ruleId" Name="$ruleName" Description="$Description" UserOrGroupSid="S-1-1-0" Action="$Action">
  <Conditions>
    <FileHashCondition>
      <FileHash Type="SHA256" Data="$hash" SourceFileName="$fileName" SourceFileLength="$fileSize" />
    </FileHashCondition>
  </Conditions>
</FileHashRule>
"@

    # STEP 3.5.8: Return the rule
    return @{
        success = $true
        id = $ruleId
        name = $ruleName
        type = 'Hash'
        action = $Action
        hash = $hash
        fileName = $fileName
        fileSize = $fileSize
        xml = $xml
    }
}

<#
.TASK 3.6: Export Rules to XML File
.PURPOSE
    Save generated rules to an AppLocker policy XML file.
    This file can be imported into Group Policy.
.HOW IT WORKS
    1. Take an array of rules (each with XML property)
    2. Wrap them in the AppLocker policy structure
    3. Save to file
#>
function Export-RulesToXml {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [array]$Rules,

        [Parameter(Mandatory = $true)]
        [string]$OutputPath,

        [ValidateSet('AuditOnly', 'Enabled', 'NotConfigured')]
        [string]$EnforcementMode = 'AuditOnly'
    )

    # STEP 3.6.1: Validate we have rules
    if (-not $Rules -or $Rules.Count -eq 0) {
        return @{
            success = $false
            error = 'No rules to export'
        }
    }

    # STEP 3.6.2: Extract XML from each rule object
    # Each rule should have an 'xml' property with the rule XML
    $rulesXml = ($Rules | ForEach-Object { $_.xml }) -join "`n    "

    # STEP 3.6.3: Build the complete AppLocker policy XML
    # This wraps our rules in the required policy structure
    $policyXml = @"
<?xml version="1.0" encoding="utf-8"?>
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="$EnforcementMode">
    $rulesXml
  </RuleCollection>
  <RuleCollection Type="Msi" EnforcementMode="NotConfigured">
  </RuleCollection>
  <RuleCollection Type="Script" EnforcementMode="NotConfigured">
  </RuleCollection>
  <RuleCollection Type="Dll" EnforcementMode="NotConfigured">
  </RuleCollection>
</AppLockerPolicy>
"@

    # STEP 3.6.4: Create output directory if needed
    $parentDir = Split-Path -Path $OutputPath -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # STEP 3.6.5: Write to file
    $policyXml | Out-File -FilePath $OutputPath -Encoding UTF8 -Force

    # STEP 3.6.6: Verify file was created
    $exists = Test-Path $OutputPath

    # STEP 3.6.7: Return result
    return @{
        success = $exists
        path = $OutputPath
        ruleCount = $Rules.Count
        enforcementMode = $EnforcementMode
    }
}

#region ============================================================
#region MODULE 4: POLICY LAB - GPO MANAGEMENT
#region ============================================================
# The Policy Lab deploys AppLocker policies via Group Policy.
# This is the deployment part of the vision: "apply to those OUs"
#endregion

<#
.TASK 4.1: Create AppLocker GPO
.PURPOSE
    Create a new Group Policy Object for AppLocker settings.
    GPOs are how we push policies to multiple computers.
.HOW IT WORKS
    1. Check if a GPO with this name already exists
    2. If not, create a new one
    3. Return the GPO object
#>
function New-AppLockerGPO {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$GpoName,

        [string]$Comment = 'AppLocker policy managed by GA-AppLocker Dashboard'
    )

    # STEP 4.1.1: Import the GroupPolicy module
    try {
        Import-Module GroupPolicy -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'GroupPolicy module not available. Run on a domain controller or install RSAT.'
        }
    }

    # STEP 4.1.2: Validate GPO name
    if ([string]::IsNullOrWhiteSpace($GpoName)) {
        return @{
            success = $false
            error = 'GPO name is required'
        }
    }

    # STEP 4.1.3: Check if GPO already exists
    $existing = Get-GPO -Name $GpoName -ErrorAction SilentlyContinue

    # STEP 4.1.4: If it exists, return the existing GPO
    if ($existing) {
        return @{
            success = $true
            gpo = $existing
            gpoName = $GpoName
            gpoId = $existing.Id.ToString()
            existed = $true
            message = 'GPO already exists'
        }
    }

    # STEP 4.1.5: Create the new GPO
    try {
        $gpo = New-GPO -Name $GpoName -Comment $Comment
    }
    catch {
        return @{
            success = $false
            error = "Failed to create GPO: $($_.Exception.Message)"
        }
    }

    # STEP 4.1.6: Return the new GPO
    return @{
        success = $true
        gpo = $gpo
        gpoName = $GpoName
        gpoId = $gpo.Id.ToString()
        existed = $false
        message = 'GPO created successfully'
    }
}

<#
.TASK 4.2: Link GPO to OU
.PURPOSE
    Connect a GPO to an Organizational Unit so it applies to computers there.
    Without linking, a GPO exists but doesn't affect anything.
.HOW IT WORKS
    1. Verify both GPO and OU exist
    2. Check if already linked
    3. Create the link if needed
#>
function Add-GPOLink {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$GpoName,

        [Parameter(Mandatory = $true)]
        [string]$TargetOU
    )

    # STEP 4.2.1: Import required modules
    try {
        Import-Module GroupPolicy -ErrorAction Stop
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'Required modules not available'
        }
    }

    # STEP 4.2.2: Verify the GPO exists
    $gpo = Get-GPO -Name $GpoName -ErrorAction SilentlyContinue
    if (-not $gpo) {
        return @{
            success = $false
            error = "GPO not found: $GpoName"
        }
    }

    # STEP 4.2.3: Verify the OU exists
    # Handle both OU DNs and domain root
    $targetExists = $false
    if ($TargetOU -like '*DC=*' -and $TargetOU -notlike '*OU=*') {
        # It's the domain root, not an OU
        $targetExists = $true
    }
    else {
        $ouCheck = Get-ADOrganizationalUnit -Filter "DistinguishedName -eq '$TargetOU'" -ErrorAction SilentlyContinue
        $targetExists = $null -ne $ouCheck
    }

    if (-not $targetExists) {
        return @{
            success = $false
            error = "Target not found: $TargetOU"
        }
    }

    # STEP 4.2.4: Check if link already exists
    $inheritance = Get-GPInheritance -Target $TargetOU -ErrorAction SilentlyContinue
    $existingLink = $inheritance.GpoLinks | Where-Object { $_.DisplayName -eq $GpoName }

    # STEP 4.2.5: If already linked, return success
    if ($existingLink) {
        return @{
            success = $true
            existed = $true
            message = 'GPO is already linked to this target'
        }
    }

    # STEP 4.2.6: Create the link
    try {
        New-GPLink -Name $GpoName -Target $TargetOU -LinkEnabled Yes -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = "Failed to create link: $($_.Exception.Message)"
        }
    }

    # STEP 4.2.7: Return success
    return @{
        success = $true
        existed = $false
        gpoName = $GpoName
        target = $TargetOU
        message = 'GPO linked successfully'
    }
}

<#
.TASK 4.3: Get All OUs with Computer Counts
.PURPOSE
    List all OUs and how many computers are in each.
    This helps decide where to deploy policies.
.HOW IT WORKS
    1. Get all OUs from AD
    2. Count computers in each OU
    3. Return the list with counts
#>
function Get-OUsWithComputerCounts {
    [CmdletBinding()]
    param()

    # STEP 4.3.1: Import ActiveDirectory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'ActiveDirectory module not available'
            data = @()
        }
    }

    # STEP 4.3.2: Get all OUs
    $ous = Get-ADOrganizationalUnit -Filter * -Properties Name, DistinguishedName

    # STEP 4.3.3: Initialize results
    $results = @()

    # STEP 4.3.4: Count computers in each OU
    foreach ($ou in $ous) {

        # STEP 4.3.5: Query computers in this OU (one level only)
        $computers = Get-ADComputer -SearchBase $ou.DistinguishedName -SearchScope OneLevel -Filter * -ErrorAction SilentlyContinue
        $count = if ($computers) { @($computers).Count } else { 0 }

        # STEP 4.3.6: Create OU object
        $obj = @{
            name = $ou.Name
            path = $ou.DistinguishedName
            computerCount = $count
        }

        # STEP 4.3.7: Add to results
        $results += $obj
    }

    # STEP 4.3.8: Sort by computer count (most first)
    $results = $results | Sort-Object -Property computerCount -Descending

    # STEP 4.3.9: Return results
    return @{
        success = $true
        data = $results
        count = $results.Count
    }
}

#region ============================================================
#region MODULE 5: EVENT MONITOR
#region ============================================================
# The Event Monitor shows AppLocker events (blocked, audited, allowed).
# This is the monitoring part of the vision.
#endregion

<#
.TASK 5.1: Get AppLocker Events
.PURPOSE
    Retrieve recent AppLocker events from the Windows Event Log.
    This shows what's being blocked, audited, or allowed.
.HOW IT WORKS
    1. Query the AppLocker event log
    2. Parse each event to extract useful info
    3. Return a list of events with details
#>
function Get-AppLockerEvents {
    [CmdletBinding()]
    param(
        [int]$MaxEvents = 100,

        [ValidateSet('All', 'Allowed', 'Audit', 'Blocked')]
        [string]$FilterType = 'All'
    )

    # STEP 5.1.1: Define the log name
    $logName = 'Microsoft-Windows-AppLocker/EXE and DLL'

    # STEP 5.1.2: Check if log exists
    $logExists = Get-WinEvent -ListLog $logName -ErrorAction SilentlyContinue
    if (-not $logExists) {
        return @{
            success = $false
            error = 'AppLocker log not found. AppLocker may not be configured.'
            data = @()
        }
    }

    # STEP 5.1.3: Query events
    try {
        $events = Get-WinEvent -LogName $logName -MaxEvents $MaxEvents -ErrorAction Stop
    }
    catch {
        if ($_.Exception.Message -match 'No events were found') {
            return @{
                success = $true
                data = @()
                message = 'No AppLocker events found'
            }
        }
        return @{
            success = $false
            error = $_.Exception.Message
            data = @()
        }
    }

    # STEP 5.1.4: Initialize results
    $results = @()

    # STEP 5.1.5: Process each event
    foreach ($event in $events) {

        # STEP 5.1.6: Get event ID
        $eventId = $event.Id

        # STEP 5.1.7: Map event ID to action
        $action = switch ($eventId) {
            8002 { 'Allowed' }
            8003 { 'Audit' }
            8004 { 'Blocked' }
            default { 'Unknown' }
        }

        # STEP 5.1.8: Apply filter if specified
        if ($FilterType -ne 'All' -and $action -ne $FilterType) {
            continue
        }

        # STEP 5.1.9: Get timestamp
        $timestamp = $event.TimeCreated

        # STEP 5.1.10: Get message and extract file path
        $message = $event.Message
        $filePath = ''
        if ($message -match '([A-Za-z]:[^\r\n"]+\.exe)') {
            $filePath = $matches[1]
        }

        # STEP 5.1.11: Create event object
        $obj = @{
            eventId = $eventId
            action = $action
            timestamp = $timestamp.ToString('yyyy-MM-dd HH:mm:ss')
            filePath = $filePath
            computerName = $event.MachineName
        }

        # STEP 5.1.12: Add to results
        $results += $obj
    }

    # STEP 5.1.13: Return results
    return @{
        success = $true
        data = $results
        count = $results.Count
    }
}

<#
.TASK 5.2: Backup Events from Remote Computer
.PURPOSE
    Save AppLocker events from a remote computer to a file.
    Useful for centralized log collection.
.HOW IT WORKS
    1. Connect to remote computer via WinRM
    2. Get AppLocker events
    3. Save to XML file
#>
function Backup-RemoteAppLockerEvents {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$ComputerName,

        [Parameter(Mandatory = $true)]
        [string]$OutputPath
    )

    # STEP 5.2.1: Validate inputs
    if ([string]::IsNullOrWhiteSpace($ComputerName)) {
        return @{ success = $false; error = 'Computer name required' }
    }

    # STEP 5.2.2: Test if computer is online
    $online = Test-Connection -ComputerName $ComputerName -Count 1 -Quiet
    if (-not $online) {
        return @{
            success = $false
            error = "Computer '$ComputerName' is not reachable"
        }
    }

    # STEP 5.2.3: Define remote script
    $scriptBlock = {
        $logName = 'Microsoft-Windows-AppLocker/EXE and DLL'
        try {
            Get-WinEvent -LogName $logName -MaxEvents 500 -ErrorAction Stop |
                Select-Object Id, TimeCreated, Message, MachineName
        }
        catch {
            @()
        }
    }

    # STEP 5.2.4: Execute remote command
    try {
        $events = Invoke-Command -ComputerName $ComputerName -ScriptBlock $scriptBlock -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = "Failed to get events: $($_.Exception.Message)"
        }
    }

    # STEP 5.2.5: Check if we got events
    if (-not $events -or $events.Count -eq 0) {
        return @{
            success = $true
            message = 'No events found on remote computer'
            count = 0
        }
    }

    # STEP 5.2.6: Create output directory
    $parentDir = Split-Path -Path $OutputPath -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # STEP 5.2.7: Export to XML
    $events | Export-Clixml -Path $OutputPath -Force

    # STEP 5.2.8: Return result
    return @{
        success = $true
        path = $OutputPath
        count = $events.Count
        computerName = $ComputerName
    }
}

#region ============================================================
#region MODULE 6: AD MANAGER
#region ============================================================
# The AD Manager handles Active Directory operations:
# - User and group management
# - AppLocker security groups
# - WinRM GPO for remote scanning
#endregion

<#
.TASK 6.1: Get All AD Users
.PURPOSE
    List all users in Active Directory with their group memberships.
    Used to manage which users get which AppLocker policies.
.HOW IT WORKS
    1. Query AD for all user objects
    2. Get their properties and group memberships
    3. Return a structured list
#>
function Get-AllADUsers {
    [CmdletBinding()]
    param(
        [int]$MaxResults = 200
    )

    # STEP 6.1.1: Import ActiveDirectory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'ActiveDirectory module not available'
            data = @()
        }
    }

    # STEP 6.1.2: Define properties to retrieve
    $properties = @('DisplayName', 'Department', 'MemberOf', 'Enabled', 'DistinguishedName')

    # STEP 6.1.3: Query all users
    $users = Get-ADUser -Filter * -Properties $properties |
        Select-Object -First $MaxResults

    # STEP 6.1.4: Initialize results
    $results = @()

    # STEP 6.1.5: Process each user
    foreach ($user in $users) {

        # STEP 6.1.6: Get username
        $samAccountName = $user.SamAccountName

        # STEP 6.1.7: Get display name (fall back to username)
        $displayName = if ($user.DisplayName) { $user.DisplayName } else { $samAccountName }

        # STEP 6.1.8: Get department
        $department = $user.Department

        # STEP 6.1.9: Extract OU from DN
        $dn = $user.DistinguishedName
        $ou = ($dn -split ',', 2)[1]

        # STEP 6.1.10: Get group names from MemberOf
        $groups = @()
        foreach ($groupDN in $user.MemberOf) {
            # Extract just the group name from the DN
            $groupName = ($groupDN -split ',')[0] -replace 'CN=', ''
            $groups += $groupName
        }

        # STEP 6.1.11: Create user object
        $obj = @{
            samAccountName = $samAccountName
            displayName = $displayName
            department = $department
            ou = $ou
            groups = $groups
            enabled = $user.Enabled
        }

        # STEP 6.1.12: Add to results
        $results += $obj
    }

    # STEP 6.1.13: Return results
    return @{
        success = $true
        data = $results
        count = $results.Count
    }
}

<#
.TASK 6.2: Create AppLocker Security Groups
.PURPOSE
    Create the security groups used to assign AppLocker policies.
    Different groups get different levels of access.
.HOW IT WORKS
    1. Define the group names we need
    2. Check which ones already exist
    3. Create the ones that don't exist
#>
function New-AppLockerGroups {
    [CmdletBinding()]
    param(
        # Optional: OU where groups should be created
        [string]$TargetOU
    )

    # STEP 6.2.1: Define the group names
    # These groups represent different levels of application access
    $groupNames = @(
        'AppLocker-Admins',           # Full access to everything
        'AppLocker-PowerUsers',       # Can run most applications
        'AppLocker-StandardUsers',    # Can run approved applications only
        'AppLocker-RestrictedUsers',  # Very limited application access
        'AppLocker-Installers',       # Can run installers
        'AppLocker-Developers'        # Can run development tools
    )

    # STEP 6.2.2: Import ActiveDirectory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'ActiveDirectory module not available'
        }
    }

    # STEP 6.2.3: Initialize results
    $results = @()

    # STEP 6.2.4: Process each group
    foreach ($groupName in $groupNames) {

        # STEP 6.2.5: Check if group already exists
        $existing = Get-ADGroup -Filter "Name -eq '$groupName'" -ErrorAction SilentlyContinue

        # STEP 6.2.6: If exists, skip creation
        if ($existing) {
            $results += @{
                name = $groupName
                created = $false
                existed = $true
            }
            continue
        }

        # STEP 6.2.7: Create the group
        try {
            $params = @{
                Name = $groupName
                GroupScope = 'Global'
                GroupCategory = 'Security'
                Description = "AppLocker security group for policy assignment"
            }

            # If target OU specified, create there
            if ($TargetOU) {
                $params['Path'] = $TargetOU
            }

            New-ADGroup @params -ErrorAction Stop

            $results += @{
                name = $groupName
                created = $true
                existed = $false
            }
        }
        catch {
            $results += @{
                name = $groupName
                created = $false
                existed = $false
                error = $_.Exception.Message
            }
        }
    }

    # STEP 6.2.8: Return results
    return @{
        success = $true
        groups = $results
        created = ($results | Where-Object { $_.created }).Count
        existing = ($results | Where-Object { $_.existed }).Count
    }
}

<#
.TASK 6.3: Add User to AppLocker Group
.PURPOSE
    Add a user to one of the AppLocker security groups.
    This determines what applications they can run.
.HOW IT WORKS
    1. Verify both user and group exist
    2. Check if user is already a member
    3. Add them if not
#>
function Add-UserToAppLockerGroup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SamAccountName,

        [Parameter(Mandatory = $true)]
        [string]$GroupName
    )

    # STEP 6.3.1: Import ActiveDirectory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{ success = $false; error = 'ActiveDirectory module not available' }
    }

    # STEP 6.3.2: Validate user exists
    $user = Get-ADUser -Filter "SamAccountName -eq '$SamAccountName'" -ErrorAction SilentlyContinue
    if (-not $user) {
        return @{ success = $false; error = "User not found: $SamAccountName" }
    }

    # STEP 6.3.3: Validate group exists
    $group = Get-ADGroup -Filter "Name -eq '$GroupName'" -ErrorAction SilentlyContinue
    if (-not $group) {
        return @{ success = $false; error = "Group not found: $GroupName" }
    }

    # STEP 6.3.4: Check if already a member
    $members = Get-ADGroupMember -Identity $GroupName -ErrorAction SilentlyContinue
    $alreadyMember = $members | Where-Object { $_.SamAccountName -eq $SamAccountName }

    if ($alreadyMember) {
        return @{
            success = $true
            alreadyMember = $true
            message = 'User is already a member of this group'
        }
    }

    # STEP 6.3.5: Add user to group
    try {
        Add-ADGroupMember -Identity $GroupName -Members $SamAccountName -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = "Failed to add user: $($_.Exception.Message)"
        }
    }

    # STEP 6.3.6: Return success
    return @{
        success = $true
        alreadyMember = $false
        message = "User '$SamAccountName' added to group '$GroupName'"
    }
}

<#
.TASK 6.4: Remove User from AppLocker Group
.PURPOSE
    Remove a user from an AppLocker security group.
    Use this when someone changes roles or leaves.
.HOW IT WORKS
    1. Verify user and group exist
    2. Remove the user from the group
#>
function Remove-UserFromAppLockerGroup {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$SamAccountName,

        [Parameter(Mandatory = $true)]
        [string]$GroupName
    )

    # STEP 6.4.1: Import ActiveDirectory module
    try {
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{ success = $false; error = 'ActiveDirectory module not available' }
    }

    # STEP 6.4.2: Validate user exists
    $user = Get-ADUser -Filter "SamAccountName -eq '$SamAccountName'" -ErrorAction SilentlyContinue
    if (-not $user) {
        return @{ success = $false; error = "User not found: $SamAccountName" }
    }

    # STEP 6.4.3: Validate group exists
    $group = Get-ADGroup -Filter "Name -eq '$GroupName'" -ErrorAction SilentlyContinue
    if (-not $group) {
        return @{ success = $false; error = "Group not found: $GroupName" }
    }

    # STEP 6.4.4: Remove user from group
    try {
        Remove-ADGroupMember -Identity $GroupName -Members $SamAccountName -Confirm:$false -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = "Failed to remove user: $($_.Exception.Message)"
        }
    }

    # STEP 6.4.5: Return success
    return @{
        success = $true
        message = "User '$SamAccountName' removed from group '$GroupName'"
    }
}

<#
.TASK 6.5: Create WinRM GPO
.PURPOSE
    Create a GPO that enables WinRM on all domain computers.
    WinRM is required for remote scanning and management.
.HOW IT WORKS
    1. Create a new GPO
    2. Configure WinRM settings via registry
    3. Link to domain root so all computers get it
#>
function New-WinRMGPO {
    [CmdletBinding()]
    param(
        [string]$GpoName = 'Enable-WinRM'
    )

    # STEP 6.5.1: Import required modules
    try {
        Import-Module GroupPolicy -ErrorAction Stop
        Import-Module ActiveDirectory -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = 'Required modules not available (GroupPolicy, ActiveDirectory)'
        }
    }

    # STEP 6.5.2: Check if GPO already exists
    $existing = Get-GPO -Name $GpoName -ErrorAction SilentlyContinue
    if ($existing) {
        return @{
            success = $true
            existed = $true
            gpoName = $GpoName
            message = 'WinRM GPO already exists'
        }
    }

    # STEP 6.5.3: Create the GPO
    try {
        $gpo = New-GPO -Name $GpoName -Comment 'Enables WinRM for remote management'
    }
    catch {
        return @{
            success = $false
            error = "Failed to create GPO: $($_.Exception.Message)"
        }
    }

    # STEP 6.5.4: Configure WinRM via registry settings
    # AllowAutoConfig = 1 enables WinRM
    try {
        Set-GPRegistryValue -Name $GpoName `
            -Key 'HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service' `
            -ValueName 'AllowAutoConfig' `
            -Type DWord `
            -Value 1
    }
    catch {
        # Continue even if this fails
    }

    # STEP 6.5.5: Set IPv4 filter to allow all
    try {
        Set-GPRegistryValue -Name $GpoName `
            -Key 'HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service' `
            -ValueName 'IPv4Filter' `
            -Type String `
            -Value '*'
    }
    catch {
        # Continue even if this fails
    }

    # STEP 6.5.6: Set IPv6 filter to allow all
    try {
        Set-GPRegistryValue -Name $GpoName `
            -Key 'HKLM\SOFTWARE\Policies\Microsoft\Windows\WinRM\Service' `
            -ValueName 'IPv6Filter' `
            -Type String `
            -Value '*'
    }
    catch {
        # Continue even if this fails
    }

    # STEP 6.5.7: Get domain DN for linking
    $domainDN = (Get-ADDomain).DistinguishedName

    # STEP 6.5.8: Link GPO to domain root
    try {
        New-GPLink -Name $GpoName -Target $domainDN -LinkEnabled Yes -ErrorAction Stop
    }
    catch {
        return @{
            success = $true
            existed = $false
            gpoName = $GpoName
            linked = $false
            message = "GPO created but failed to link: $($_.Exception.Message)"
        }
    }

    # STEP 6.5.9: Return success
    return @{
        success = $true
        existed = $false
        gpoName = $GpoName
        linked = $true
        linkedTo = $domainDN
        message = 'WinRM GPO created and linked to domain'
    }
}

#region ============================================================
#region MODULE 7: COMPLIANCE
#region ============================================================
# The Compliance module collects evidence and generates reports.
# Used for audits and demonstrating security controls.
#endregion

<#
.TASK 7.1: Create Evidence Folder Structure
.PURPOSE
    Set up the folder structure for storing compliance evidence.
    Organized folders make audits easier.
.HOW IT WORKS
    1. Define the folder structure we need
    2. Create each folder if it doesn't exist
    3. Return the paths for later use
#>
function New-EvidenceFolders {
    [CmdletBinding()]
    param(
        [string]$BasePath = 'C:\AppLocker\Evidence'
    )

    # STEP 7.1.1: Define the folders we need
    $folders = @(
        'Policies',    # AppLocker policy exports
        'Events',      # Event log backups
        'Inventory',   # Software inventory
        'Reports',     # Generated reports
        'Scans'        # Scan results
    )

    # STEP 7.1.2: Create base directory
    if (-not (Test-Path $BasePath)) {
        try {
            New-Item -ItemType Directory -Path $BasePath -Force | Out-Null
        }
        catch {
            return @{
                success = $false
                error = "Failed to create base directory: $($_.Exception.Message)"
            }
        }
    }

    # STEP 7.1.3: Create each subfolder
    $createdFolders = @{}
    foreach ($folder in $folders) {
        $fullPath = Join-Path -Path $BasePath -ChildPath $folder

        if (-not (Test-Path $fullPath)) {
            New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
        }

        $createdFolders[$folder] = $fullPath
    }

    # STEP 7.1.4: Return all paths
    return @{
        success = $true
        basePath = $BasePath
        folders = $createdFolders
    }
}

<#
.TASK 7.2: Export Current AppLocker Policy
.PURPOSE
    Save the current AppLocker policy to a file.
    Required evidence for security audits.
.HOW IT WORKS
    1. Get the effective AppLocker policy
    2. Export to XML file
    3. Return the file path
#>
function Export-CurrentPolicy {
    [CmdletBinding()]
    param(
        [string]$OutputPath = 'C:\AppLocker\Evidence\Policies\CurrentPolicy.xml'
    )

    # STEP 7.2.1: Get the effective policy
    try {
        $policy = Get-AppLockerPolicy -Effective -Xml -ErrorAction Stop
    }
    catch {
        return @{
            success = $false
            error = "Failed to get policy: $($_.Exception.Message)"
        }
    }

    # STEP 7.2.2: Check if we got a policy
    if ([string]::IsNullOrWhiteSpace($policy)) {
        return @{
            success = $false
            error = 'No AppLocker policy is configured'
        }
    }

    # STEP 7.2.3: Create output directory
    $parentDir = Split-Path -Path $OutputPath -Parent
    if (-not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Path $parentDir -Force | Out-Null
    }

    # STEP 7.2.4: Write to file
    $policy | Out-File -FilePath $OutputPath -Encoding UTF8 -Force

    # STEP 7.2.5: Verify and return
    $exists = Test-Path $OutputPath
    return @{
        success = $exists
        path = $OutputPath
        timestamp = Get-Date -Format 'o'
    }
}

<#
.TASK 7.3: Generate Compliance Summary
.PURPOSE
    Create a summary of the current AppLocker compliance state.
    Shows what's configured, what's missing, and recent activity.
.HOW IT WORKS
    1. Get policy health score
    2. Get event statistics
    3. Count rules by type
    4. Calculate overall score
#>
function Get-ComplianceSummary {
    [CmdletBinding()]
    param()

    # STEP 7.3.1: Initialize summary
    $summary = @{
        timestamp = Get-Date -Format 'o'
        computerName = $env:COMPUTERNAME
    }

    # STEP 7.3.2: Get policy health
    $health = Get-PolicyHealthScore
    $summary.policyScore = $health.score
    $summary.hasExeRules = $health.hasExe
    $summary.hasMsiRules = $health.hasMsi
    $summary.hasScriptRules = $health.hasScript
    $summary.hasDllRules = $health.hasDll

    # STEP 7.3.3: Get event statistics
    $events = Get-AppLockerEventStatistics
    $summary.eventsAllowed = $events.allowed
    $summary.eventsAudit = $events.audit
    $summary.eventsBlocked = $events.blocked

    # STEP 7.3.4: Calculate compliance indicators
    # High audit events = need more rules before enforcing
    # High blocked events = policy is working but may be too strict
    $summary.readyToEnforce = $events.audit -lt 10
    $summary.tooRestrictive = $events.blocked -gt 100

    # STEP 7.3.5: Overall assessment
    if ($health.score -eq 100 -and $summary.readyToEnforce) {
        $summary.assessment = 'Excellent - Ready for enforcement'
    }
    elseif ($health.score -ge 50) {
        $summary.assessment = 'Good - Some categories need rules'
    }
    elseif ($health.score -gt 0) {
        $summary.assessment = 'Fair - More configuration needed'
    }
    else {
        $summary.assessment = 'Not Configured - AppLocker not set up'
    }

    # STEP 7.3.6: Return summary
    return @{
        success = $true
        data = $summary
    }
}

#region ============================================================
#region WORKFLOW ORCHESTRATION
#region ============================================================
# These functions combine multiple tasks into complete workflows.
# They implement the full vision end-to-end.
#endregion

<#
.WORKFLOW: Complete AppLocker Deployment
.PURPOSE
    Run the entire AppLocker deployment workflow:
    1. Discover machines in AD
    2. Scan for artifacts
    3. Generate rules
    4. Create and deploy policy
.IMPLEMENTS
    The complete vision: "Scan AD for hosts, then scan the hosts for artifacts,
    ingest those artifacts seamlessly to automatically create rules based on
    best practices, then merge all rules to create a policy and apply to OUs"
#>
function Start-AppLockerDeployment {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$TargetOU,

        [string]$PolicyName = 'AppLocker-Policy',

        [ValidateSet('AuditOnly', 'Enabled')]
        [string]$EnforcementMode = 'AuditOnly',

        [string]$OutputFolder = 'C:\AppLocker'
    )

    Write-Host "=== GA-AppLocker Deployment Workflow ===" -ForegroundColor Cyan
    Write-Host "Target OU: $TargetOU"
    Write-Host "Enforcement Mode: $EnforcementMode"
    Write-Host ""

    # WORKFLOW STEP 1: Discover machines
    Write-Host "[1/6] Discovering machines in AD..." -ForegroundColor Yellow
    $machines = Get-ComputersByOU -OUPath $TargetOU
    if (-not $machines.success) {
        Write-Host "ERROR: $($machines.error)" -ForegroundColor Red
        return $machines
    }
    Write-Host "  Found $($machines.count) computers" -ForegroundColor Green

    # WORKFLOW STEP 2: Check which machines are online
    Write-Host "[2/6] Checking machine availability..." -ForegroundColor Yellow
    $onlineMachines = @()
    foreach ($machine in $machines.data) {
        $status = Test-ComputerOnline -ComputerName $machine.hostname
        if ($status.online) {
            $onlineMachines += $machine
        }
    }
    Write-Host "  $($onlineMachines.Count) machines are online" -ForegroundColor Green

    # WORKFLOW STEP 3: Scan for artifacts
    Write-Host "[3/6] Scanning for software artifacts..." -ForegroundColor Yellow
    $allArtifacts = @()
    foreach ($machine in $onlineMachines | Select-Object -First 5) {
        Write-Host "  Scanning $($machine.hostname)..."
        $scan = Get-RemoteArtifacts -ComputerName $machine.hostname
        if ($scan.success) {
            $allArtifacts += $scan.data
        }
    }
    Write-Host "  Collected $($allArtifacts.Count) artifacts" -ForegroundColor Green

    # WORKFLOW STEP 4: Generate rules from artifacts
    Write-Host "[4/6] Generating AppLocker rules..." -ForegroundColor Yellow
    $rules = @()
    $publishers = $allArtifacts | Where-Object { $_.publisher -and $_.publisher -ne 'Unknown' } |
        Select-Object -ExpandProperty publisher -Unique

    foreach ($publisher in $publishers | Select-Object -First 20) {
        $rule = New-PublisherRule -PublisherName $publisher -Action 'Allow'
        if ($rule.success) {
            $rules += $rule
        }
    }
    Write-Host "  Generated $($rules.Count) rules" -ForegroundColor Green

    # WORKFLOW STEP 5: Export policy
    Write-Host "[5/6] Exporting AppLocker policy..." -ForegroundColor Yellow
    $policyPath = Join-Path $OutputFolder "$PolicyName.xml"
    $export = Export-RulesToXml -Rules $rules -OutputPath $policyPath -EnforcementMode $EnforcementMode
    if (-not $export.success) {
        Write-Host "ERROR: Failed to export policy" -ForegroundColor Red
        return $export
    }
    Write-Host "  Policy saved to $policyPath" -ForegroundColor Green

    # WORKFLOW STEP 6: Create and link GPO
    Write-Host "[6/6] Creating and linking GPO..." -ForegroundColor Yellow
    $gpo = New-AppLockerGPO -GpoName $PolicyName
    if ($gpo.success) {
        $link = Add-GPOLink -GpoName $PolicyName -TargetOU $TargetOU
        if ($link.success) {
            Write-Host "  GPO '$PolicyName' linked to $TargetOU" -ForegroundColor Green
        }
    }

    # WORKFLOW COMPLETE
    Write-Host ""
    Write-Host "=== Deployment Complete ===" -ForegroundColor Cyan
    Write-Host "- Machines discovered: $($machines.count)"
    Write-Host "- Machines scanned: $($onlineMachines.Count)"
    Write-Host "- Artifacts collected: $($allArtifacts.Count)"
    Write-Host "- Rules generated: $($rules.Count)"
    Write-Host "- Policy file: $policyPath"
    Write-Host "- Enforcement: $EnforcementMode"
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Run 'gpupdate /force' on target machines"
    Write-Host "2. Monitor events with Get-AppLockerEvents"
    Write-Host "3. Add more rules as needed"
    Write-Host "4. Switch to 'Enabled' mode when ready"

    return @{
        success = $true
        machinesFound = $machines.count
        machinesScanned = $onlineMachines.Count
        artifactsCollected = $allArtifacts.Count
        rulesGenerated = $rules.Count
        policyPath = $policyPath
        enforcementMode = $EnforcementMode
    }
}

#endregion

# Export all functions
Export-ModuleMember -Function *

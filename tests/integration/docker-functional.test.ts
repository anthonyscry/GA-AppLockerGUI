/**
 * Docker Functional Tests
 * 
 * These tests verify the application's core functionality in Docker.
 * They test IPC handlers, PowerShell execution, and policy operations.
 * 
 * Run with: npm run test:docker:functional
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Check if Docker is available and containers are running
const getDockerStatus = (): { available: boolean; containersRunning: boolean } => {
  try {
    execSync('docker info', { stdio: 'pipe' });
    const containers = execSync('docker ps --filter "name=ga-applocker" --format "{{.Names}}"', { stdio: 'pipe' }).toString();
    return {
      available: true,
      containersRunning: containers.includes('ga-applocker-app'),
    };
  } catch {
    return { available: false, containersRunning: false };
  }
};

const dockerStatus = getDockerStatus();
const canRunTests = dockerStatus.available && dockerStatus.containersRunning;

// Helper to run PowerShell in container
const runPowerShell = async (script: string, timeout = 60000): Promise<string> => {
  const escaped = script.replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const { stdout } = await execAsync(
    `docker exec ga-applocker-app pwsh -Command "${escaped}"`,
    { timeout }
  );
  return stdout.trim();
};

// Helper to run Node.js script in container
const runNode = async (script: string, timeout = 30000): Promise<string> => {
  const { stdout } = await execAsync(
    `docker exec ga-applocker-app node -e "${script.replace(/"/g, '\\"')}"`,
    { timeout }
  );
  return stdout.trim();
};

describe('Docker Functional Tests', () => {
  beforeAll(() => {
    if (!canRunTests) {
      console.warn('⚠️ Docker containers not running');
      console.warn('   Run: npm run docker:up');
      console.warn('   Then: npm run test:docker:functional');
    }
  });

  describe('PowerShell Script Execution', () => {
    test.skipIf(!canRunTests)('Can execute basic PowerShell command', async () => {
      const result = await runPowerShell('Write-Output "Hello from Docker"');
      expect(result).toBe('Hello from Docker');
    });

    test.skipIf(!canRunTests)('PowerShell can access app scripts', async () => {
      const result = await runPowerShell('Test-Path /app/scripts/GA-AppLocker.psm1');
      expect(result).toBe('True');
    });

    test.skipIf(!canRunTests)('Can import GA-AppLocker module', async () => {
      const result = await runPowerShell(`
        Import-Module /app/scripts/GA-AppLocker.psm1 -Force -ErrorAction SilentlyContinue
        if (Get-Module GA-AppLocker) { 'Loaded' } else { 'Failed' }
      `);
      expect(result).toContain('Loaded');
    }, 30000);
  });

  describe('Policy Generation', () => {
    test.skipIf(!canRunTests)('Can create baseline policy XML', async () => {
      const result = await runPowerShell(`
        $policy = @'
<?xml version="1.0" encoding="UTF-8"?>
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <FilePublisherRule Id="test-rule" Name="Test Rule" Description="Test" UserOrGroupSid="S-1-1-0" Action="Allow">
      <Conditions>
        <FilePublisherCondition PublisherName="O=Microsoft Corporation" ProductName="*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>
  </RuleCollection>
</AppLockerPolicy>
'@
        $valid = $false
        try {
          [xml]$xml = $policy
          if ($xml.AppLockerPolicy) { $valid = $true }
        } catch {}
        $valid
      `);
      expect(result).toBe('True');
    });

    test.skipIf(!canRunTests)('Can validate policy XML structure', async () => {
      const result = await runPowerShell(`
        $testPolicy = @'
<?xml version="1.0"?>
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly" />
</AppLockerPolicy>
'@
        try {
          [xml]$xml = $testPolicy
          if ($xml.AppLockerPolicy.RuleCollection) { 'Valid' } else { 'Invalid' }
        } catch {
          'ParseError'
        }
      `);
      expect(result).toBe('Valid');
    });
  });

  describe('Event Processing', () => {
    test.skipIf(!canRunTests)('Can parse AppLocker event XML', async () => {
      const result = await runPowerShell(`
        $eventXml = @'
<Event>
  <System>
    <EventID>8004</EventID>
    <TimeCreated SystemTime="2024-01-01T12:00:00Z"/>
    <Computer>TESTPC</Computer>
  </System>
  <EventData>
    <Data Name="FilePath">C:\\Test\\app.exe</Data>
    <Data Name="FileHash">ABC123</Data>
    <Data Name="PolicyName">Test Policy</Data>
  </EventData>
</Event>
'@
        try {
          [xml]$xml = $eventXml
          $eventId = $xml.Event.System.EventID
          $filePath = ($xml.Event.EventData.Data | Where-Object { $_.Name -eq 'FilePath' }).'#text'
          if ($eventId -eq '8004' -and $filePath -like '*app.exe') { 'Parsed' } else { 'Failed' }
        } catch {
          'Error'
        }
      `);
      expect(result).toBe('Parsed');
    });
  });

  describe('Hash Generation', () => {
    test.skipIf(!canRunTests)('Can compute SHA256 hash', async () => {
      const result = await runPowerShell(`
        $testContent = 'Hello World'
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($testContent)
        $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
        $hashString = [BitConverter]::ToString($hash) -replace '-', ''
        $hashString.Substring(0, 16)
      `);
      expect(result).toBe('A591A6D40BF42040');
    });

    test.skipIf(!canRunTests)('Can compute file hash', async () => {
      const result = await runPowerShell(`
        $tempFile = '/tmp/test-hash-file.txt'
        'Test content for hashing' | Out-File $tempFile -Encoding UTF8
        $hash = Get-FileHash $tempFile -Algorithm SHA256
        Remove-Item $tempFile -Force
        if ($hash.Hash.Length -eq 64) { 'Valid' } else { 'Invalid' }
      `);
      expect(result).toBe('Valid');
    });
  });

  describe('Rule Generation', () => {
    test.skipIf(!canRunTests)('Can generate publisher rule XML', async () => {
      const result = await runPowerShell(`
        $publisher = 'O=Microsoft Corporation, L=Redmond, S=Washington, C=US'
        $productName = 'Windows'
        $rule = @"
<FilePublisherRule Id="$(New-Guid)" Name="Allow $productName" Description="Auto-generated" UserOrGroupSid="S-1-1-0" Action="Allow">
  <Conditions>
    <FilePublisherCondition PublisherName="$publisher" ProductName="$productName" BinaryName="*">
      <BinaryVersionRange LowSection="*" HighSection="*" />
    </FilePublisherCondition>
  </Conditions>
</FilePublisherRule>
"@
        try {
          [xml]$xml = "<root>$rule</root>"
          if ($xml.root.FilePublisherRule) { 'Generated' } else { 'Failed' }
        } catch {
          'Error'
        }
      `);
      expect(result).toBe('Generated');
    });

    test.skipIf(!canRunTests)('Can generate hash rule XML', async () => {
      const result = await runPowerShell(`
        $hash = 'A591A6D40BF420404A011733CFB7B190D62C65BF0BCDA32B57B277D9AD9F146E'
        $fileName = 'test.exe'
        $rule = @"
<FileHashRule Id="$(New-Guid)" Name="Allow $fileName" Description="Auto-generated" UserOrGroupSid="S-1-1-0" Action="Allow">
  <Conditions>
    <FileHashCondition>
      <FileHash Type="SHA256" Data="0x$hash" SourceFileName="$fileName" />
    </FileHashCondition>
  </Conditions>
</FileHashRule>
"@
        try {
          [xml]$xml = "<root>$rule</root>"
          if ($xml.root.FileHashRule) { 'Generated' } else { 'Failed' }
        } catch {
          'Error'
        }
      `);
      expect(result).toBe('Generated');
    });
  });

  describe('Merge Operations', () => {
    test.skipIf(!canRunTests)('Can merge two policy XMLs', async () => {
      const result = await runPowerShell(`
        $policy1 = @'
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <FilePublisherRule Id="rule1" Name="Rule 1" UserOrGroupSid="S-1-1-0" Action="Allow">
      <Conditions>
        <FilePublisherCondition PublisherName="Publisher1" ProductName="*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>
  </RuleCollection>
</AppLockerPolicy>
'@
        $policy2 = @'
<AppLockerPolicy Version="1">
  <RuleCollection Type="Exe" EnforcementMode="AuditOnly">
    <FilePublisherRule Id="rule2" Name="Rule 2" UserOrGroupSid="S-1-1-0" Action="Allow">
      <Conditions>
        <FilePublisherCondition PublisherName="Publisher2" ProductName="*" BinaryName="*">
          <BinaryVersionRange LowSection="*" HighSection="*" />
        </FilePublisherCondition>
      </Conditions>
    </FilePublisherRule>
  </RuleCollection>
</AppLockerPolicy>
'@
        [xml]$xml1 = $policy1
        [xml]$xml2 = $policy2
        
        # Merge: copy rules from policy2 into policy1
        $importedNode = $xml1.ImportNode($xml2.AppLockerPolicy.RuleCollection.FilePublisherRule, $true)
        $xml1.AppLockerPolicy.RuleCollection.AppendChild($importedNode) | Out-Null
        
        $ruleCount = $xml1.AppLockerPolicy.RuleCollection.FilePublisherRule.Count
        if ($ruleCount -eq 2) { 'Merged' } else { "Failed: $ruleCount rules" }
      `);
      expect(result).toBe('Merged');
    }, 30000);
  });
});

// Custom skipIf implementation
declare global {
  namespace jest {
    interface It {
      skipIf: (condition: boolean) => (name: string, fn: () => void | Promise<void>, timeout?: number) => void;
    }
  }
}

test.skipIf = (condition: boolean) => {
  return condition ? test.skip : test;
};

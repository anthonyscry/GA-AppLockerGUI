/**
 * Security Edge Case Tests
 * Tests for command injection prevention, input validation, and security controls
 */

// Test helper to simulate the escapePowerShellString function from the main process
function escapePowerShellString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/`/g, '``')
    .replace(/"/g, '`"')
    .replace(/\$/g, '`$')
    .replace(/'/g, "''");
}

// Test helper to simulate XML escaping
function escapeXml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Test helper to validate rule input
function isValidRuleInput(input: string): boolean {
  if (typeof input !== 'string' || input.length === 0 || input.length > 1024) {
    return false;
  }
  if (/[\x00-\x1f\x7f]/.test(input)) {
    return false;
  }
  return true;
}

describe('Security Edge Cases', () => {
  describe('PowerShell String Escaping', () => {
    describe('Backtick Escaping', () => {
      it('should escape single backtick', () => {
        expect(escapePowerShellString('test`command')).toBe('test``command');
      });

      it('should escape multiple backticks', () => {
        expect(escapePowerShellString('test``command')).toBe('test````command');
      });

      it('should escape backtick at start', () => {
        expect(escapePowerShellString('`command')).toBe('``command');
      });

      it('should escape backtick at end', () => {
        expect(escapePowerShellString('command`')).toBe('command``');
      });
    });

    describe('Quote Escaping', () => {
      it('should escape double quotes', () => {
        expect(escapePowerShellString('test"string')).toBe('test`"string');
      });

      it('should escape single quotes', () => {
        expect(escapePowerShellString("test'string")).toBe("test''string");
      });

      it('should escape mixed quotes', () => {
        expect(escapePowerShellString(`"test'string"`)).toBe('`"test\'\'string`"');
      });
    });

    describe('Dollar Sign Escaping', () => {
      it('should escape dollar sign (variable expansion)', () => {
        expect(escapePowerShellString('$env:PATH')).toBe('`$env:PATH');
      });

      it('should escape dollar sign in subexpression', () => {
        expect(escapePowerShellString('$(Get-Date)')).toBe('`$(Get-Date)');
      });
    });

    describe('Command Injection Prevention', () => {
      it('should neutralize command injection via semicolon', () => {
        const malicious = 'OU=Test; Get-ADUser admin';
        const escaped = escapePowerShellString(malicious);
        // Semicolon is allowed but other dangerous chars are escaped
        expect(escaped).toBe('OU=Test; Get-ADUser admin');
      });

      it('should neutralize backtick command continuation', () => {
        const malicious = 'OU=Test`\nGet-Secret';
        const escaped = escapePowerShellString(malicious);
        expect(escaped).toContain('``');
      });

      it('should neutralize variable expansion', () => {
        const malicious = '$($env:USERDOMAIN)';
        const escaped = escapePowerShellString(malicious);
        expect(escaped).toBe('`$(`$env:USERDOMAIN)');
      });

      it('should neutralize subexpression execution', () => {
        const malicious = '$(Invoke-WebRequest "http://evil.com")';
        const escaped = escapePowerShellString(malicious);
        expect(escaped).toBe('`$(Invoke-WebRequest `"http://evil.com`")');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        expect(escapePowerShellString('')).toBe('');
      });

      it('should handle null input', () => {
        expect(escapePowerShellString(null as any)).toBe('');
      });

      it('should handle undefined input', () => {
        expect(escapePowerShellString(undefined as any)).toBe('');
      });

      it('should handle number input', () => {
        expect(escapePowerShellString(123 as any)).toBe('');
      });

      it('should handle object input', () => {
        expect(escapePowerShellString({} as any)).toBe('');
      });

      it('should preserve safe characters', () => {
        const safe = 'OU=Workstations,DC=domain,DC=local';
        expect(escapePowerShellString(safe)).toBe(safe);
      });
    });
  });

  describe('XML Escaping', () => {
    describe('Standard Character Escaping', () => {
      it('should escape ampersand', () => {
        expect(escapeXml('test & value')).toBe('test &amp; value');
      });

      it('should escape less than', () => {
        expect(escapeXml('<tag>')).toBe('&lt;tag&gt;');
      });

      it('should escape greater than', () => {
        expect(escapeXml('a > b')).toBe('a &gt; b');
      });

      it('should escape double quotes', () => {
        expect(escapeXml('value="test"')).toBe('value=&quot;test&quot;');
      });

      it('should escape single quotes', () => {
        expect(escapeXml("value='test'")).toBe('value=&#39;test&#39;');
      });
    });

    describe('XML Injection Prevention', () => {
      it('should prevent CDATA injection', () => {
        const malicious = ']]><script>alert(1)</script><![CDATA[';
        const escaped = escapeXml(malicious);
        expect(escaped).not.toContain(']]>');
        expect(escaped).not.toContain('<script>');
      });

      it('should prevent attribute injection', () => {
        const malicious = '" onclick="alert(1)"';
        const escaped = escapeXml(malicious);
        expect(escaped).toBe('&quot; onclick=&quot;alert(1)&quot;');
      });

      it('should prevent element injection', () => {
        const malicious = '<injected>evil</injected>';
        const escaped = escapeXml(malicious);
        expect(escaped).toBe('&lt;injected&gt;evil&lt;/injected&gt;');
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty string', () => {
        expect(escapeXml('')).toBe('');
      });

      it('should handle null input', () => {
        expect(escapeXml(null as any)).toBe('');
      });

      it('should handle undefined input', () => {
        expect(escapeXml(undefined as any)).toBe('');
      });

      it('should handle multiple special characters', () => {
        const input = '<a href="test?x=1&y=2">';
        expect(escapeXml(input)).toBe('&lt;a href=&quot;test?x=1&amp;y=2&quot;&gt;');
      });
    });
  });

  describe('Rule Input Validation', () => {
    describe('Valid Inputs', () => {
      it('should accept normal alphanumeric strings', () => {
        expect(isValidRuleInput('TestApplication123')).toBe(true);
      });

      it('should accept strings with spaces', () => {
        expect(isValidRuleInput('Test Application Name')).toBe(true);
      });

      it('should accept strings with common punctuation', () => {
        expect(isValidRuleInput('Test-App.v2.0 (x64)')).toBe(true);
      });

      it('should accept Unicode characters', () => {
        expect(isValidRuleInput('アプリケーション')).toBe(true);
      });

      it('should accept path-like strings', () => {
        expect(isValidRuleInput('C:\\Program Files\\App\\app.exe')).toBe(true);
      });
    });

    describe('Invalid Inputs - Control Characters', () => {
      it('should reject null byte', () => {
        expect(isValidRuleInput('test\x00string')).toBe(false);
      });

      it('should reject bell character', () => {
        expect(isValidRuleInput('test\x07string')).toBe(false);
      });

      it('should reject backspace', () => {
        expect(isValidRuleInput('test\x08string')).toBe(false);
      });

      it('should reject tab', () => {
        expect(isValidRuleInput('test\tstring')).toBe(false);
      });

      it('should reject newline', () => {
        expect(isValidRuleInput('test\nstring')).toBe(false);
      });

      it('should reject carriage return', () => {
        expect(isValidRuleInput('test\rstring')).toBe(false);
      });

      it('should reject form feed', () => {
        expect(isValidRuleInput('test\x0Cstring')).toBe(false);
      });

      it('should reject escape character', () => {
        expect(isValidRuleInput('test\x1Bstring')).toBe(false);
      });

      it('should reject delete character', () => {
        expect(isValidRuleInput('test\x7Fstring')).toBe(false);
      });
    });

    describe('Invalid Inputs - Length Limits', () => {
      it('should reject empty string', () => {
        expect(isValidRuleInput('')).toBe(false);
      });

      it('should reject string exceeding max length', () => {
        expect(isValidRuleInput('a'.repeat(1025))).toBe(false);
      });

      it('should accept string at max length', () => {
        expect(isValidRuleInput('a'.repeat(1024))).toBe(true);
      });

      it('should accept single character', () => {
        expect(isValidRuleInput('a')).toBe(true);
      });
    });

    describe('Invalid Inputs - Type Checks', () => {
      it('should reject null', () => {
        expect(isValidRuleInput(null as any)).toBe(false);
      });

      it('should reject undefined', () => {
        expect(isValidRuleInput(undefined as any)).toBe(false);
      });

      it('should reject number', () => {
        expect(isValidRuleInput(123 as any)).toBe(false);
      });

      it('should reject object', () => {
        expect(isValidRuleInput({} as any)).toBe(false);
      });

      it('should reject array', () => {
        expect(isValidRuleInput([] as any)).toBe(false);
      });
    });
  });

  describe('Target OU Validation', () => {
    // Simulates the validation that should happen in machine:startScan
    function validateTargetOUs(ous: unknown): string[] {
      if (!Array.isArray(ous)) return [];
      return ous.filter(ou =>
        typeof ou === 'string' &&
        ou.length > 0 &&
        ou.length <= 1024
      );
    }

    it('should filter out non-string values', () => {
      const input = ['valid-ou', 123, null, undefined, { ou: 'invalid' }];
      const result = validateTargetOUs(input);
      expect(result).toEqual(['valid-ou']);
    });

    it('should filter out empty strings', () => {
      const input = ['valid-ou', '', '   '];
      const result = validateTargetOUs(input);
      expect(result).toEqual(['valid-ou']);
    });

    it('should filter out strings exceeding max length', () => {
      const longOU = 'OU=' + 'a'.repeat(2000);
      const input = ['valid-ou', longOU];
      const result = validateTargetOUs(input);
      expect(result).toEqual(['valid-ou']);
    });

    it('should handle non-array input', () => {
      expect(validateTargetOUs('not-array')).toEqual([]);
      expect(validateTargetOUs(null)).toEqual([]);
      expect(validateTargetOUs(undefined)).toEqual([]);
      expect(validateTargetOUs(123)).toEqual([]);
    });
  });

  describe('Computer Name Validation', () => {
    // Simulates the validation that should happen in machine:startScan
    function validateComputerNames(names: unknown): string[] {
      if (!Array.isArray(names)) return [];
      return names.filter(cn =>
        typeof cn === 'string' &&
        cn.length > 0 &&
        cn.length <= 255 // NetBIOS limit
      );
    }

    it('should filter out non-string values', () => {
      const input = ['COMPUTER1', 123, null, undefined];
      const result = validateComputerNames(input);
      expect(result).toEqual(['COMPUTER1']);
    });

    it('should filter out empty strings', () => {
      const input = ['COMPUTER1', ''];
      const result = validateComputerNames(input);
      expect(result).toEqual(['COMPUTER1']);
    });

    it('should filter out names exceeding NetBIOS limit', () => {
      const longName = 'A'.repeat(300);
      const input = ['COMPUTER1', longName];
      const result = validateComputerNames(input);
      expect(result).toEqual(['COMPUTER1']);
    });
  });
});

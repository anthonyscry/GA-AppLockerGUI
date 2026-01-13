# 🚀 Quick Test Guide - Windows Server 2019

## One Command Testing

```powershell
cd docker
.\run-windows2019-tests.ps1 -All
```

That's it! This will:
1. Build containers
2. Start services
3. Run all tests
4. Generate reports

## What Gets Tested

### ✅ Domain Controller
- Domain creation
- DNS service
- AD DS service
- User/group creation

### ✅ Client
- Domain join
- WinRM connectivity
- AppLocker functionality
- Policy operations
- Event logs

## Results

Check `.\test-results\` folder for:
- JSON reports (detailed)
- HTML reports (visual)

## Need Help?

See `TESTING_WINDOWS2019.md` for detailed documentation.

---

**Status**: ✅ Ready to test!

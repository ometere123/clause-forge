const axios = require('axios');

const BACKEND_URL = 'http://localhost:54249/api/v1';

const testCases = [
  {
    name: 'Test 1: Complex Data Storage (@allow_storage @dataclass)',
    description: 'Create a contract that stores complex user profiles with nested information. Each profile should store name, email, reputation score (0-100), verification status, and a list of achievements. The contract should have a method to submit a new profile, validate it using an LLM (check if name looks legitimate), and store it in state. Return the profile data when queried.'
  },
  {
    name: 'Test 2: Multiple Web Fetches Combined',
    description: 'Create a contract that evaluates research papers. For a given paper DOI, fetch the paper metadata from a real API (use crossref or doi.org), fetch any retraction information, and use one LLM call to analyze everything together. The LLM should return a single JSON with: is_legitimate (true/false/unverifiable), confidence (0-100), and reasoning. All fetches must be in ONE leader function.'
  },
  {
    name: 'Test 3: F-Strings with JSON Schemas',
    description: 'Create a contract for dispute resolution. The contract should take a dispute description and use an LLM to classify it. The LLM prompt must be an f-string that includes a JSON schema with literal braces (doubled because f-string syntax). The JSON should have: category (contract|payment|delivery|quality|other), severity (critical|high|medium|low), and recommendation (approved|rejected|needs_review). Test that braces are correctly escaped.'
  }
];

async function testContract(testCase) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 ${testCase.name}`);
    console.log(`${'='.repeat(70)}`);
    
    const response = await axios.post(`${BACKEND_URL}/contracts/generate`, {
      description: testCase.description,
      model: 'groq'
    }, {
      timeout: 60000
    });

    const { data: contract } = response.data;
    
    console.log(`✅ SUCCESS - Contract Generated`);
    console.log(`\n📊 Contract Stats:`);
    console.log(`  • Contract Name: ${contract.contractName}`);
    console.log(`  • Generated Code: ${contract.generatedCode.length} chars`);
    console.log(`  • State Variables: ${Object.keys(contract.stateVariables).length}`);
    console.log(`  • Methods: ${contract.methods.length}`);
    
    console.log(`\n📋 Capabilities:`);
    console.log(`  • Needs LLM: ${contract.estimation.capabilities.needsLlm}`);
    console.log(`  • Needs Web Fetch: ${contract.estimation.capabilities.needsWebFetch}`);
    console.log(`  • Needs Data Access: ${contract.estimation.capabilities.needsDataAccess}`);
    
    console.log(`\n🔍 Code Quality Checks:`);
    const code = contract.generatedCode;
    
    // Check 1: Has proper header
    const hasHeader = code.includes('{ "Depends"');
    console.log(`  ${hasHeader ? '✅' : '❌'} Depends header`);
    
    // Check 2: Has genlayer import
    const hasImport = code.includes('from genlayer import');
    console.log(`  ${hasImport ? '✅' : '❌'} genlayer import`);
    
    // Check 3: No DynArray() constructor calls with arguments
    const hasDynArrayConstructor = code.match(/DynArray\[.*?\]\(\[/);
    console.log(`  ${!hasDynArrayConstructor ? '✅' : '❌'} No DynArray([...]) constructors`);
    
    // Check 4: f-string brace safety
    const fstrings = code.match(/f('{3}|"'{3}|"{3})[\s\S]*?\1/g) || [];
    let braceSafe = true;
    if (fstrings.length > 0) {
      // Simple check: look for unescaped braces in JSON patterns
      fstrings.forEach(fstr => {
        if (fstr.match(/:\s*\{[^{]/) || fstr.match(/\}\s*[,\n]/)) {
          braceSafe = false;
        }
      });
      console.log(`  ${braceSafe ? '✅' : '❌'} f-string braces (${fstrings.length} f-strings)`);
    } else {
      console.log(`  ℹ️  No f-strings in code`);
    }
    
    // Check 5: run_nondet_unsafe wrapping
    if (code.includes('gl.nondet')) {
      const hasNondetWrapper = code.includes('gl.vm.run_nondet_unsafe');
      console.log(`  ${hasNondetWrapper ? '✅' : '❌'} Nondet wrapped in run_nondet_unsafe`);
    }
    
    // Check 6: @allow_storage for test 1
    if (testCase.name.includes('Complex Data')) {
      const hasStorageClass = code.includes('@allow_storage') && code.includes('@dataclass');
      console.log(`  ${hasStorageClass ? '✅' : '❌'} @allow_storage @dataclass for complex storage`);
    }
    
    console.log(`\n📄 Generated Code Preview (first 400 chars):`);
    console.log(`\`\`\`python`);
    console.log(code.substring(0, 400).replace(/`/g, ''));
    console.log(`\`\`\``);
    
    return { name: testCase.name, success: true };
  } catch (error) {
    console.log(`❌ FAILED`);
    console.log(`Error: ${error.message}`);
    if (error.response?.status === 404) {
      console.log(`  (Backend endpoint not found - check route)`);
    }
    return { name: testCase.name, success: false };
  }
}

async function runAllTests() {
  console.log('\n🚀 TESTING IMPROVED SYSTEM PROMPT - X100 ENHANCEMENT');
  console.log(`Backend: ${BACKEND_URL}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testContract(testCase);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 SUMMARY');
  console.log(`${'='.repeat(70)}`);
  
  results.forEach((r, idx) => {
    console.log(`${r.success ? '✅' : '❌'} ${idx + 1}. ${r.name}`);
  });
  
  const passed = results.filter(r => r.success).length;
  console.log(`\n✅ Passed: ${passed}/${results.length}\n`);
}

runAllTests().catch(console.error);

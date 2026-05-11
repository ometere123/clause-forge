const axios = require('axios');

const BACKEND_URL = 'http://localhost:54249';

const testCases = [
  {
    name: 'Test 1: Complex Data Storage (@allow_storage @dataclass)',
    description: 'Create a contract that stores complex user profiles with nested information. Each profile should store name, email, reputation score (0-100), verification status, and a list of achievements. The contract should have a method to submit a new profile, validate it using an LLM (check if name looks legitimate), and store it in state. Return the profile data when queried.'
  },
  {
    name: 'Test 2: Multiple Web Fetches Combined',
    description: 'Create a contract that evaluates research papers. For a given paper DOI, fetch the paper metadata from a real API (use doi.org or crossref API), fetch any retraction information, and use one LLM call to analyze everything together. The LLM should return a single JSON with: is_legitimate (true/false/unverifiable), confidence (0-100), and reasoning. All fetches must be in ONE leader function.'
  },
  {
    name: 'Test 3: F-Strings with JSON Schemas',
    description: 'Create a contract for dispute resolution. The contract should take a dispute description and use an LLM to classify it. The LLM prompt must be an f-string that includes a JSON schema with literal braces (doubled). The JSON should have: category ("contract|payment|delivery|quality|other"), severity ("critical|high|medium|low"), and recommendation ("approved|rejected|needs_review"). Test that the f-string braces are correctly escaped to prevent ValueError at deploy time.'
  }
];

async function testContract(testCase) {
  try {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`🧪 ${testCase.name}`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Description: ${testCase.description.substring(0, 100)}...`);
    
    const response = await axios.post(`${BACKEND_URL}/api/contracts/generate`, {
      description: testCase.description,
      model: 'groq'
    }, {
      timeout: 30000
    });

    const { data: contract } = response.data;
    
    console.log(`✅ SUCCESS - Contract Generated`);
    console.log(`\n📊 Contract Stats:`);
    console.log(`  • Contract Name: ${contract.contractName}`);
    console.log(`  • Generated Code Length: ${contract.generatedCode.length} chars`);
    console.log(`  • State Variables: ${Object.keys(contract.stateVariables).length}`);
    console.log(`  • Methods: ${contract.methods.length}`);
    console.log(`  • LLM Used: ${contract.modelUsed}`);
    console.log(`  • Tokens: ${contract.estimation.tokensInput} input, ${contract.estimation.tokensOutput} output`);
    console.log(`  • Estimated Cost: $${contract.estimation.estimatedCostUsd.toFixed(4)}`);
    
    console.log(`\n📋 Capabilities:`);
    console.log(`  • Needs LLM: ${contract.estimation.capabilities.needsLlm}`);
    console.log(`  • Needs Web Fetch: ${contract.estimation.capabilities.needsWebFetch}`);
    console.log(`  • Needs Data Access: ${contract.estimation.capabilities.needsDataAccess}`);
    
    console.log(`\n🔍 Code Quality Checks:`);
    const code = contract.generatedCode;
    
    // Check 1: Has proper header
    if (code.includes('{ "Depends"')) {
      console.log(`  ✅ Has Depends header`);
    } else {
      console.log(`  ❌ Missing Depends header`);
    }
    
    // Check 2: Has genlayer import
    if (code.includes('from genlayer import')) {
      console.log(`  ✅ Has genlayer import`);
    } else {
      console.log(`  ❌ Missing genlayer import`);
    }
    
    // Check 3: No DynArray() constructor calls
    if (!code.match(/DynArray\[.*?\]\(\[/)) {
      console.log(`  ✅ No dangerous DynArray([...]) constructors`);
    } else {
      console.log(`  ❌ Found DynArray([...]) constructor - CRASH!`);
    }
    
    // Check 4: No f-string brace issues (if f-strings present)
    const fstrings = code.match(/f"""[\s\S]*?"""/g) || code.match(/f'''[\s\S]*?'''/g) || [];
    if (fstrings.length > 0) {
      let braceIssues = false;
      fstrings.forEach((fstr, idx) => {
        // Look for single braces in JSON (not {{ or }})
        if (fstr.match(/:\s*\{[^{]/)) {
          console.log(`  ❌ f-string #${idx + 1}: Unescaped brace - CRASH!`);
          braceIssues = true;
        }
      });
      if (!braceIssues) {
        console.log(`  ✅ All f-string braces properly escaped (${fstrings.length} f-strings)`);
      }
    } else {
      console.log(`  ℹ️  No f-strings in code`);
    }
    
    // Check 5: run_nondet_unsafe wrapping
    if (code.includes('gl.nondet')) {
      if (code.includes('gl.vm.run_nondet_unsafe')) {
        console.log(`  ✅ Nondet operations wrapped in run_nondet_unsafe`);
      } else {
        console.log(`  ❌ Nondet operations NOT wrapped - FAIL!`);
      }
    }
    
    // Check 6: No nested run_nondet_unsafe (in helper methods)
    const runNondetCount = (code.match(/gl\.vm\.run_nondet_unsafe/g) || []).length;
    if (runNondetCount === 1) {
      console.log(`  ✅ Single run_nondet_unsafe call (no nesting)`);
    } else if (runNondetCount > 1) {
      console.log(`  ⚠️  Multiple run_nondet_unsafe calls - possible nesting`);
    }
    
    // Check 7: @allow_storage for test 1
    if (testCase.name.includes('Complex Data')) {
      if (code.includes('@allow_storage') && code.includes('@dataclass')) {
        console.log(`  ✅ Has @allow_storage @dataclass for complex storage`);
      } else {
        console.log(`  ⚠️  Missing @allow_storage @dataclass`);
      }
    }
    
    console.log(`\n📄 First 500 chars of generated code:`);
    console.log(`\`\`\`python`);
    console.log(code.substring(0, 500));
    console.log(`...\`\`\``);
    
    return { name: testCase.name, success: true };
  } catch (error) {
    console.log(`❌ ERROR - ${error.message}`);
    if (error.response?.data) {
      console.log(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return { name: testCase.name, success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('\n🚀 TESTING IMPROVED SYSTEM PROMPT - X100 ENHANCEMENT');
  console.log(`Testing at: ${BACKEND_URL}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);
  
  const results = [];
  
  for (const testCase of testCases) {
    const result = await testContract(testCase);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
  }
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('📊 TEST SUMMARY');
  console.log(`${'='.repeat(70)}`);
  
  results.forEach((r, idx) => {
    const status = r.success ? '✅' : '❌';
    console.log(`${status} ${idx + 1}. ${r.name}`);
  });
  
  const passed = results.filter(r => r.success).length;
  console.log(`\n✅ Passed: ${passed}/${results.length}`);
}

runAllTests().catch(console.error);

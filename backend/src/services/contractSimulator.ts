import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SimulationRequest, SimulationResult } from '../types'

export const simulateContractMethod = async (
  request: SimulationRequest
): Promise<SimulationResult> => {
  const { code, methodName, inputs } = request

  // Build inputs dict for Python
  const inputsDict = Object.entries(inputs)
    .map(([key, value]) => {
      try {
        return `"${key}": ${JSON.parse(value)}`
      } catch {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `"${key}": "${escaped}"`
      }
    })
    .join(', ')

  const tmpDir = tmpdir()
  const timestamp = Date.now()
  const contractFile = join(tmpDir, `contract_code_${timestamp}.py`)
  const runnerFile = join(tmpDir, `contract_runner_${timestamp}.py`)

  // Runner script that imports and executes the contract
  const runnerScript = `
import sys
import inspect
import importlib.util
import types

# Build a proper mock genlayer module so "from genlayer import *" gives 'gl'
class _GlNamespace:
    class public:
        @staticmethod
        def view(f): return f
        @staticmethod
        def write(f): return f

    class Contract:
        pass

    @staticmethod
    def exec_prompt(prompt, **kwargs):
        return "[simulated AI response]"

    @staticmethod
    def http_get(url, **kwargs):
        return "[simulated HTTP response]"

    @staticmethod
    def get_data(key):
        return None

_gl_instance = _GlNamespace()

_mock_module = types.ModuleType('genlayer')
_mock_module.gl = _gl_instance
_mock_module.Contract = _GlNamespace.Contract
_mock_module.__all__ = ['gl', 'Contract']

sys.modules['genlayer'] = _mock_module

try:
    # Load the contract module from file
    spec = importlib.util.spec_from_file_location("contract_module", "${contractFile.replace(/\\/g, '\\\\')}")
    contract_module = importlib.util.module_from_spec(spec)
    sys.modules['contract_module'] = contract_module
    spec.loader.exec_module(contract_module)

    # Find the contract class (must be a subclass of gl.Contract, not Contract itself)
    BaseContract = sys.modules['genlayer'].Contract
    classes = [name for name, obj in vars(contract_module).items()
               if inspect.isclass(obj)
               and issubclass(obj, BaseContract)
               and obj is not BaseContract]

    if not classes:
        raise Exception("No contract class found")

    ContractClass = getattr(contract_module, classes[0])

    # Instantiate and call method
    contract = ContractClass()
    method = getattr(contract, '${methodName}', None)

    if not method:
        raise Exception(f"Method '${methodName}' not found on {classes[0]}")

    # Call with inputs
    inputs = {${inputsDict}}
    result = method(**inputs) if inputs else method()

    # Print result
    if isinstance(result, (str, int, float, bool, type(None))):
        print(result if result is not None else "(None)")
    else:
        print(str(result))

except Exception as e:
    import traceback
    traceback.print_exc()
    sys.exit(1)
`

  try {
    // Write contract code to file (as-is, no escaping issues)
    writeFileSync(contractFile, code)

    // Write runner script to file
    writeFileSync(runnerFile, runnerScript)

    // Execute with timeout
    let output: string
    try {
      output = execSync(`python3 "${runnerFile}"`, {
        timeout: 30000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch {
      output = execSync(`python "${runnerFile}"`, {
        timeout: 30000,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    }

    return {
      success: true,
      output: output.trim(),
      error: null,
      executionTimeMs: 0,
    }
  } catch (error: any) {
    const stderr = error.stderr?.toString() || ''
    const stdout = error.stdout?.toString() || ''
    const errorMsg = stderr || stdout || error.message || 'Unknown error'

    return {
      success: false,
      output: stdout.trim(),
      error: errorMsg.trim(),
      executionTimeMs: 0,
    }
  } finally {
    // Clean up temp files
    try {
      unlinkSync(contractFile)
    } catch {}
    try {
      unlinkSync(runnerFile)
    } catch {}
  }
}

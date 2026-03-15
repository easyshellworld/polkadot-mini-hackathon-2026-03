import { NextRequest, NextResponse } from 'next/server';
import solc from 'solc';
import * as fs from 'fs';
import * as path from 'path';

interface CompileRequest {
  source: string;
  version?: string;
  optimize?: boolean;
  runs?: number;
}

// Function to find all OpenZeppelin contract imports in the source
function findImports(source: string): Record<string, { content: string }> {
  const imports: Record<string, { content: string }> = {};
  const importRegex = /import\s+["'](@openzeppelin\/contracts\/[^"']+)["'];/g;
  let match;

  while ((match = importRegex.exec(source)) !== null) {
    const importPath = match[1];
    try {
      // Convert the npm package path to actual file path
      const filePath = path.resolve(
        process.cwd(),
        'node_modules',
        importPath
      );
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        imports[importPath] = { content };
        
        // Recursively find nested imports
        const nestedImports = findImports(content);
        Object.assign(imports, nestedImports);
      }
    } catch (error) {
      console.error(`Failed to load import ${importPath}:`, error);
    }
  }
  
  return imports;
}

export async function POST(request: NextRequest) {
  try {
    const body: CompileRequest = await request.json();
    const { source, version = '0.8.28', optimize = true, runs = 200 } = body;

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'Source code is required' },
        { status: 400 }
      );
    }

    // Find all OpenZeppelin imports
    const imports = findImports(source);

    // Create input for solc compiler
    const input = {
      language: 'Solidity',
      sources: {
        'contract.sol': {
          content: source
        },
        ...imports
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*']
          }
        },
        optimizer: {
          enabled: optimize,
          runs: runs
        }
      }
    };

    // Compile the contract
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Check for compilation errors
    if (output.errors) {
      const errors = output.errors.filter((error: any) => error.severity === 'error');
      const warnings = output.errors.filter((error: any) => error.severity === 'warning');

      if (errors.length > 0) {
        return NextResponse.json({
          success: false,
          errors: errors,
          warnings: warnings
        });
      }
    }

    // Extract contract data
    const contracts = output.contracts['contract.sol'];
    const contractNames = Object.keys(contracts);
    
    if (contractNames.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No contracts found in source code' },
        { status: 400 }
      );
    }

    // Get the first contract (assuming single contract file)
    const contractName = contractNames[0];
    const contract = contracts[contractName];

    return NextResponse.json({
      success: true,
      output: {
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: contract.evm.deployedBytecode.object,
        metadata: contract.metadata,
        contractName: contractName
      },
      warnings: output.errors?.filter((error: any) => error.severity === 'warning') || []
    });

  } catch (error) {
    console.error('Compilation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown compilation error' 
      },
      { status: 500 }
    );
  }
}

// Add a simple GET method for testing
export async function GET() {
  return NextResponse.json({ 
    message: 'Compile API is working',
    timestamp: new Date().toISOString()
  });
}
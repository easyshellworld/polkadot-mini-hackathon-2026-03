/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_DARK_POOL_ADDRESS?: string;
	readonly VITE_VERIFIER_ADDRESS?: string;
	readonly VITE_EVM_DIRECT_SUBMIT?: string;
	readonly VITE_EVM_CHAIN_ID_HEX?: string;
	readonly VITE_EVM_CHAIN_NAME?: string;
	readonly VITE_EVM_RPC_URL?: string;
	readonly VITE_EVM_EXPLORER_URL?: string;
	readonly VITE_EVM_CURRENCY_SYMBOL?: string;
	readonly VITE_EVM_WETH_TOKEN_ADDRESS?: string;
	readonly VITE_EVM_USDC_TOKEN_ADDRESS?: string;
	readonly VITE_EVM_BRIDGE_SPENDER_ADDRESS?: string;
	readonly VITE_WESTEND_ASSET_HUB_WS?: string;
	readonly VITE_GROTH16_VERIFIER_ADDRESS?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}

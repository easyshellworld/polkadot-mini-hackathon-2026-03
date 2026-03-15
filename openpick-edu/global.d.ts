interface Window {
  ethereum?: {
    isMetaMask?: boolean;
    request: (...args: any[]) => Promise<any>;
    send: (...args: any[]) => Promise<any>;
    on: (event: string, listener: (...args: any[]) => void) => void;
    removeListener: (event: string, listener: (...args: any[]) => void) => void;
  };
}
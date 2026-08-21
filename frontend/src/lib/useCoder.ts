import { useEffect, useState } from "react";
import { getCoder, setCoder as persistCoder } from "./api";

export function useCoder() {
  const [coder, setCoderState] = useState(getCoder);

  useEffect(() => {
    persistCoder(coder);
  }, [coder]);

  return [coder, setCoderState] as const;
}

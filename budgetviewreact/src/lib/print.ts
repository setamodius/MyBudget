import { useState, useCallback } from "react"

export function usePrint() {
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = useCallback(async () => {
    const wasDark = document.documentElement.classList.contains("dark")
    if (wasDark) document.documentElement.classList.remove("dark")
    setIsPrinting(true)

    // Two frames so React renders expanded state before browser snapshots
    await new Promise(r => requestAnimationFrame(r))
    await new Promise(r => requestAnimationFrame(r))

    const restore = () => {
      setIsPrinting(false)
      if (wasDark) document.documentElement.classList.add("dark")
      window.removeEventListener("afterprint", restore)
    }
    window.addEventListener("afterprint", restore)

    window.print()
  }, [])

  return { isPrinting, handlePrint }
}

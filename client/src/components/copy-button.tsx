import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label = "Копировать" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      toast.success("Скопировано в буфер обмена");
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast.error("Не удалось скопировать — браузер запретил доступ к буферу");
    }
  };

  return (
    <Button variant="soft" size="sm" onClick={copy} disabled={!text}>
      {done ? <Check /> : <Copy />}
      {label}
    </Button>
  );
}

/** PwaInstall — capte beforeinstallprompt → bouton « installer ». Sur iOS (pas
 *  d'événement), affiche l'astuce Partager → Sur l'écran d'accueil. */
import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}

export function PwaInstall() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [done, setDone] = useState(false);
  const isIos = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = typeof window !== "undefined" && window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (standalone || done) return null;
  if (deferred) {
    return (
      <span className="wt-install">
        <button
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDone(true);
            setDeferred(null);
          }}
        >
          ⤓ Installer l'app
        </button>
      </span>
    );
  }
  if (isIos) {
    return <span>Installer : Partager → « Sur l'écran d'accueil »</span>;
  }
  return null;
}

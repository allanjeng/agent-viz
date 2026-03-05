import { useEffect, useRef } from "react";

import { OfficeScene } from "../pixi/officeScene";
import { AgentState } from "../types";

type OfficeCanvasProps = {
  agents: AgentState[];
};

export function OfficeCanvas({ agents }: OfficeCanvasProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<OfficeScene | null>(null);

  useEffect(() => {
    if (!rootRef.current) {
      return undefined;
    }

    const scene = new OfficeScene(rootRef.current);
    sceneRef.current = scene;

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setAgents(agents);
  }, [agents]);

  return <div ref={rootRef} className="office-canvas" />;
}

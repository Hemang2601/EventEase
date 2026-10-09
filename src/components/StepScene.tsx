import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { CanvasTexture, Color, Group, Mesh, SRGBColorSpace } from "three";

export type StepSceneProps = { index: number; active: boolean; reduced: boolean };

function Badge({ index, reduced }: Pick<StepSceneProps, "index" | "reduced">) {
  const group = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const time = useRef(index * 1.4);
  const { primary, surface, edge, texture } = useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    // Resolve CSS's perceptual colors through the browser before passing to Three.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const resolve = (token: string) => {
      if (!ctx) return new Color();
      ctx.fillStyle = css.getPropertyValue(token).trim();
      ctx.fillRect(0, 0, 1, 1);
      const pixel = ctx.getImageData(0, 0, 1, 1).data;
      return new Color().setRGB((pixel[0] ?? 0) / 255, (pixel[1] ?? 0) / 255, (pixel[2] ?? 0) / 255, SRGBColorSpace);
    };
    const primary = resolve("--primary");
    const surface = resolve("--accent");
    const edge = resolve("--border");
    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);
      ctx.strokeStyle = css.getPropertyValue("--primary").trim();
      ctx.lineWidth = 1.7;
      ctx.lineCap = ctx.lineJoin = "round";
      ctx.scale(8, 8);
      ctx.translate(4, 4);
      const paths = [
        "M8 2V6 M16 2V6 M3 10H21 M19 4H5Q3 4 3 6V20Q3 22 5 22H19Q21 22 21 20V6Q21 4 19 4 M12 13V19 M9 16H15",
        "M16 21V19Q16 15 12 15H6Q2 15 2 19V21 M9 3A4 4 0 1 1 8.99 11 M20 8V14 M17 11H23",
        "M3 5H21V9Q17 9 17 12Q17 15 21 15V19H3V15Q7 15 7 12Q7 9 3 9Z M12 7V9 M12 11V13 M12 15V17",
        "M8 3H5Q3 3 3 5V8 M16 3H19Q21 3 21 5V8 M3 16V19Q3 21 5 21H8 M16 21H19Q21 21 21 19V16 M8 12L11 15L17 9",
      ];
      ctx.stroke(new Path2D(paths[index] ?? paths[0]));
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return { primary, surface, edge, texture };
  }, [index]);
  useEffect(() => () => texture.dispose(), [texture]);
  useFrame((state, delta) => {
    if (!group.current || reduced) return;
    time.current += Math.min(delta, 0.05);
    const t = time.current;
    group.current.position.y = Math.sin(t * 1.3) * 0.07;
    const blend = 1 - Math.exp(-5 * Math.min(delta, 0.05));
    group.current.rotation.y += (Math.sin(t * 0.7) * 0.12 + state.pointer.x * 0.18 - group.current.rotation.y) * blend;
    group.current.rotation.x += (-0.08 + Math.cos(t * 0.9) * 0.04 - state.pointer.y * 0.12 - group.current.rotation.x) * blend;
    if (beam.current) beam.current.position.y = Math.sin(t * 2) * 0.63;
  });
  return (
    <group ref={group} rotation={[-0.08, 0.12, 0]}>
      <RoundedBox args={[1.95, 1.95, 0.2]} radius={0.16} smoothness={4}>
        <meshStandardMaterial color={edge} metalness={0} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[1.89, 1.89, 0.12]} radius={0.14} smoothness={4} position={[0, 0, 0.08]}>
        <meshBasicMaterial color={surface} />
      </RoundedBox>
      <mesh position={[0, 0, 0.151]}>
        <planeGeometry args={[1.65, 1.65]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
      {index === 3 && <mesh ref={beam} position={[0, 0, 0.17]}>
        <boxGeometry args={[1.35, 0.018, 0.015]} />
        <meshBasicMaterial color={primary} transparent opacity={0.3} />
      </mesh>}
    </group>
  );
}

export default function StepScene({ index, active, reduced }: StepSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0, 5.6], fov: 35 }} dpr={1} frameloop={active && !reduced ? "always" : "demand"} gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}>
      <ambientLight intensity={1} />
      <directionalLight position={[3, 4, 5]} intensity={0.7} />
      <Badge index={index} reduced={reduced} />
    </Canvas>
  );
}
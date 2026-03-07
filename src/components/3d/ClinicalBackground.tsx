import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── Floating ECG Background Lines ─── */
const ECGBackgroundLine = ({
  position,
  width,
  opacity,
  speed,
}: {
  position: [number, number, number];
  width: number;
  opacity: number;
  speed: number;
}) => {
  const ref = useRef<THREE.Group>(null);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 60;
    for (let i = 0; i < segments; i++) {
      const x = (i / segments) * width - width / 2;
      const t = (i % 15) / 15;
      let y = 0;
      if (t < 0.15) y = Math.sin(t / 0.15 * Math.PI) * 0.03;
      else if (t < 0.25) y = -0.05;
      else if (t < 0.35) y = 0.2;
      else if (t < 0.45) y = -0.07;
      else if (t < 0.6) y = Math.sin((t - 0.45) / 0.15 * Math.PI) * 0.05;
      else y = 0;
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return pts;
  }, [width]);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed) * 0.05;
    }
  });

  return (
    <group ref={ref} position={position}>
      <line geometry={geometry}>
        <lineBasicMaterial color="#4dd8e0" transparent opacity={opacity} />
      </line>
    </group>
  );
};

/* ─── Diagnostic Grid ─── */
const DiagnosticGrid = ({ position }: { position: [number, number, number] }) => {
  const lines = useMemo(() => {
    const arr: Float32Array = new Float32Array(200 * 3);
    let idx = 0;
    const size = 8;
    const step = 1;
    // Horizontal lines
    for (let y = -size / 2; y <= size / 2; y += step) {
      arr[idx++] = -size / 2; arr[idx++] = y; arr[idx++] = 0;
      arr[idx++] = size / 2; arr[idx++] = y; arr[idx++] = 0;
    }
    // Vertical lines
    for (let x = -size / 2; x <= size / 2; x += step) {
      arr[idx++] = x; arr[idx++] = -size / 2; arr[idx++] = 0;
      arr[idx++] = x; arr[idx++] = size / 2; arr[idx++] = 0;
    }
    return { array: arr.slice(0, idx), count: idx / 3 };
  }, []);

  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={lines.count}
            array={lines.array}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#4dd8e0" transparent opacity={0.03} />
      </lineSegments>
    </group>
  );
};

/* ─── Mini Medical UI Panel (holographic) ─── */
const MiniPanel = ({
  position,
  rotation,
  width,
  height,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  width: number;
  height: number;
}) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
    }
  });

  return (
    <group ref={ref} position={position} rotation={rotation || [0, 0, 0]}>
      {/* Panel background */}
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#4dd8e0"
          emissive="#4dd8e0"
          emissiveIntensity={0.1}
          transparent
          opacity={0.04}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* Border */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, height)]} />
        <lineBasicMaterial color="#4dd8e0" transparent opacity={0.12} />
      </lineSegments>
      {/* Simulated data lines inside panel */}
      {[...Array(3)].map((_, i) => {
        const lineY = (i - 1) * (height / 4);
        const lineWidth = width * 0.8 * (0.5 + Math.random() * 0.5);
        return (
          <mesh key={i} position={[-width * 0.4 + lineWidth / 2, lineY, 0.001]}>
            <planeGeometry args={[lineWidth, 0.01]} />
            <meshBasicMaterial color="#4dd8e0" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
};

/* ─── Main Export ─── */
const ClinicalBackground = () => {
  return (
    <group>
      {/* Floor grid */}
      <DiagnosticGrid position={[0, -2.5, 0]} />

      {/* Background ECG lines */}
      <ECGBackgroundLine position={[-4, 3, -4]} width={8} opacity={0.06} speed={0.3} />
      <ECGBackgroundLine position={[2, -2, -5]} width={6} opacity={0.04} speed={0.4} />
      <ECGBackgroundLine position={[-2, 1, -6]} width={10} opacity={0.03} speed={0.25} />

      {/* Floating mini panels */}
      <MiniPanel position={[4.5, 2.5, -3]} rotation={[0, -0.4, 0.05]} width={1} height={0.6} />
      <MiniPanel position={[-4, -1.5, -2.5]} rotation={[0, 0.3, -0.03]} width={0.8} height={0.5} />
      <MiniPanel position={[3.5, -1.8, -4]} rotation={[0, -0.2, 0.02]} width={0.7} height={0.45} />
    </group>
  );
};

export default ClinicalBackground;

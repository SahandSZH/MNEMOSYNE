import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ─── DNA Helix ─── */
const DNAHelix = ({ position }: { position: [number, number, number] }) => {
  const groupRef = useRef<THREE.Group>(null);
  const RUNGS = 20;

  const { strand1, strand2, rungs } = useMemo(() => {
    const s1: [number, number, number][] = [];
    const s2: [number, number, number][] = [];
    const r: { start: [number, number, number]; end: [number, number, number] }[] = [];
    for (let i = 0; i < RUNGS; i++) {
      const t = (i / RUNGS) * Math.PI * 4;
      const y = (i / RUNGS) * 2.4 - 1.2;
      const x1 = Math.cos(t) * 0.25;
      const z1 = Math.sin(t) * 0.25;
      const x2 = Math.cos(t + Math.PI) * 0.25;
      const z2 = Math.sin(t + Math.PI) * 0.25;
      s1.push([x1, y, z1]);
      s2.push([x2, y, z2]);
      if (i % 2 === 0) r.push({ start: [x1, y, z1], end: [x2, y, z2] });
    }
    return { strand1: s1, strand2: s2, rungs: r };
  }, []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.3;
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4) * 0.2;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      {/* Strand spheres */}
      {strand1.map((p, i) => (
        <mesh key={`s1-${i}`} position={p}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {strand2.map((p, i) => (
        <mesh key={`s2-${i}`} position={p}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial color="#6c8cff" emissive="#6c8cff" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* Rungs */}
      {rungs.map((r, i) => {
        const mid: [number, number, number] = [
          (r.start[0] + r.end[0]) / 2,
          (r.start[1] + r.end[1]) / 2,
          (r.start[2] + r.end[2]) / 2,
        ];
        const len = Math.sqrt(
          (r.end[0] - r.start[0]) ** 2 + (r.end[2] - r.start[2]) ** 2
        );
        const angle = Math.atan2(r.end[2] - r.start[2], r.end[0] - r.start[0]);
        return (
          <mesh key={`r-${i}`} position={mid} rotation={[0, -angle, 0]}>
            <boxGeometry args={[len, 0.015, 0.015]} />
            <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.3} transparent opacity={0.6} />
          </mesh>
        );
      })}
      <pointLight color="#4dd8e0" intensity={0.3} distance={2} />
    </group>
  );
};

/* ─── Medical Cross ─── */
const MedicalCross = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.25) * 0.2;
      ref.current.rotation.y = state.clock.elapsedTime * 0.15;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.15;
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Vertical bar */}
      <mesh>
        <boxGeometry args={[0.12, 0.5, 0.04]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
      {/* Horizontal bar */}
      <mesh>
        <boxGeometry args={[0.5, 0.12, 0.04]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.5} transparent opacity={0.85} />
      </mesh>
      {/* Glow ring */}
      <mesh>
        <ringGeometry args={[0.35, 0.38, 32]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.3} transparent opacity={0.2} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

/* ─── Pill Capsule ─── */
const PillCapsule = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.z = state.clock.elapsedTime * 0.2;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.6) * 0.15;
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Top half */}
      <mesh position={[0, 0.12, 0]}>
        <capsuleGeometry args={[0.08, 0.12, 8, 12]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.4} transparent opacity={0.8} />
      </mesh>
      {/* Bottom half */}
      <mesh position={[0, -0.12, 0]}>
        <capsuleGeometry args={[0.08, 0.12, 8, 12]} />
        <meshStandardMaterial color="#6c8cff" emissive="#6c8cff" emissiveIntensity={0.4} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

/* ─── Heart Pulse / ECG Waveform Ribbon ─── */
const HeartPulseRibbon = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Line>(null);
  const groupRef = useRef<THREE.Group>(null);

  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 80;
    for (let i = 0; i < segments; i++) {
      const x = (i / segments) * 3 - 1.5;
      const phase = (i / segments) * Math.PI * 2;
      let y = 0;
      // ECG-like waveform: P-QRS-T pattern repeated
      const t = (i % 20) / 20;
      if (t < 0.15) y = Math.sin(t / 0.15 * Math.PI) * 0.05;
      else if (t < 0.25) y = -0.08;
      else if (t < 0.35) y = 0.35;
      else if (t < 0.45) y = -0.12;
      else if (t < 0.6) y = Math.sin((t - 0.45) / 0.15 * Math.PI) * 0.08;
      else y = 0;
      pts.push(new THREE.Vector3(x, y, 0));
    }
    return pts;
  }, []);

  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.4) * 0.1;
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <line ref={ref as any} geometry={geometry}>
        <lineBasicMaterial color="#4dd8e0" transparent opacity={0.8} />
      </line>
      {/* Glow duplicate */}
      <line geometry={geometry}>
        <lineBasicMaterial color="#4dd8e0" transparent opacity={0.2} linewidth={1} />
      </line>
    </group>
  );
};

/* ─── Stethoscope Shape ─── */
const Stethoscope = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.12;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.55) * 0.12;
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Chest piece - disc */}
      <mesh>
        <cylinderGeometry args={[0.12, 0.12, 0.03, 24]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.5} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Tube - torus arc */}
      <mesh position={[0, 0.2, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.18, 0.02, 8, 24, Math.PI]} />
        <meshStandardMaterial color="#6c8cff" emissive="#6c8cff" emissiveIntensity={0.3} />
      </mesh>
      {/* Ear tips */}
      <mesh position={[-0.18, 0.2, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.18, 0.2, 0]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
};

/* ─── Microscope Silhouette ─── */
const Microscope = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.2) * 0.3;
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.45) * 0.1;
    }
  });

  return (
    <group ref={ref} position={position}>
      {/* Base */}
      <mesh position={[0, -0.25, 0]}>
        <boxGeometry args={[0.3, 0.04, 0.2]} />
        <meshStandardMaterial color="#34d399" emissive="#34d399" emissiveIntensity={0.3} transparent opacity={0.7} />
      </mesh>
      {/* Pillar */}
      <mesh position={[0.08, 0, 0]}>
        <boxGeometry args={[0.04, 0.5, 0.04]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.3} transparent opacity={0.7} />
      </mesh>
      {/* Eyepiece */}
      <mesh position={[-0.04, 0.22, 0]} rotation={[0, 0, -0.5]}>
        <cylinderGeometry args={[0.03, 0.02, 0.15, 8]} />
        <meshStandardMaterial color="#6c8cff" emissive="#6c8cff" emissiveIntensity={0.4} transparent opacity={0.8} />
      </mesh>
      {/* Stage */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.14]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.2} transparent opacity={0.5} />
      </mesh>
    </group>
  );
};

/* ─── Diagnostic Scan Rings ─── */
const ScanRings = ({ position }: { position: [number, number, number] }) => {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.2;
      ref.current.rotation.z = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <group ref={ref} position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.01, 8, 48]} />
        <meshStandardMaterial color="#4dd8e0" emissive="#4dd8e0" emissiveIntensity={0.5} transparent opacity={0.5} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0.4, 0.3]}>
        <torusGeometry args={[0.32, 0.008, 8, 48]} />
        <meshStandardMaterial color="#6c8cff" emissive="#6c8cff" emissiveIntensity={0.4} transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, -0.3, 0.6]}>
        <torusGeometry args={[0.24, 0.006, 8, 48]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.3} transparent opacity={0.3} />
      </mesh>
    </group>
  );
};

/* ─── Main Export ─── */
const FloatingIcons = () => {
  return (
    <group>
      <DNAHelix position={[3.2, 1.2, 0.5]} />
      <MedicalCross position={[-3, 1.5, 1]} />
      <PillCapsule position={[1.8, 2.2, -1.5]} />
      <HeartPulseRibbon position={[0, -1.2, 1]} />
      <Stethoscope position={[-2, -0.3, 2]} />
      <Microscope position={[3.5, -0.8, -1]} />
      <ScanRings position={[-1.5, 2, -2]} />
      <ScanRings position={[2.5, 0.5, 2]} />
    </group>
  );
};

export default FloatingIcons;

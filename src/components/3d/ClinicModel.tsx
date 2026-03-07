import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

const FLOORS = [
  { name: "Diagnostics", y: 0, color: "#4dd8e0" },
  { name: "Neurology", y: 0.45, color: "#6c8cff" },
  { name: "Cardiology", y: 0.9, color: "#a78bfa" },
  { name: "Research Lab", y: 1.35, color: "#34d399" },
];

const Floor = ({ name, y, color }: { name: string; y: number; color: string }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <group position={[0, y, 0]}>
      <mesh
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[1, 0.35, 0.8]} />
        <meshStandardMaterial
          color={hovered ? color : "#1a2332"}
          emissive={color}
          emissiveIntensity={hovered ? 0.4 : 0.05}
          transparent
          opacity={hovered ? 0.9 : 0.7}
        />
      </mesh>
      {/* Floor edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(1, 0.35, 0.8)]} />
        <lineBasicMaterial color={color} transparent opacity={hovered ? 0.8 : 0.2} />
      </lineSegments>
      {hovered && (
        <Html distanceFactor={6} center position={[0.7, 0, 0]}>
          <div className="glass-panel glow-border px-3 py-1.5 pointer-events-none whitespace-nowrap">
            <span className="text-xs font-display font-semibold text-primary">{name}</span>
          </div>
        </Html>
      )}
    </group>
  );
};

const ClinicModel = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <group ref={groupRef} position={[2.2, -0.5, -1]}>
      {FLOORS.map((floor) => (
        <Floor key={floor.name} {...floor} />
      ))}
      {/* Base platform */}
      <mesh position={[0, -0.3, 0]}>
        <cylinderGeometry args={[0.9, 1, 0.05, 32]} />
        <meshStandardMaterial color="#4dd8e0" transparent opacity={0.1} />
      </mesh>
    </group>
  );
};

export default ClinicModel;

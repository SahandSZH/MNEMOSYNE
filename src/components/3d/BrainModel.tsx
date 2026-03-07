import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

interface BrainRegion {
  name: string;
  position: [number, number, number];
  color: string;
}

const REGIONS: BrainRegion[] = [
  { name: "Memory", position: [0.4, 0.2, 0.3], color: "#4dd8e0" },
  { name: "Language", position: [-0.4, 0.3, 0.2], color: "#6c8cff" },
  { name: "Motor", position: [0, 0.5, 0], color: "#a78bfa" },
  { name: "Vision", position: [0, -0.2, -0.4], color: "#34d399" },
];

const BrainRegionNode = ({ region }: { region: BrainRegion }) => {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.scale.setScalar(hovered ? 1.5 : 1);
    }
  });

  return (
    <group position={region.position}>
      <mesh
        ref={ref}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial
          color={region.color}
          emissive={region.color}
          emissiveIntensity={hovered ? 1.5 : 0.5}
          transparent
          opacity={hovered ? 1 : 0.8}
        />
      </mesh>
      {hovered && (
        <Html distanceFactor={5} center>
          <div className="glass-panel glow-border px-3 py-1.5 pointer-events-none whitespace-nowrap">
            <span className="text-xs font-display font-semibold text-primary">
              {region.name}
            </span>
          </div>
        </Html>
      )}
      {/* Connection lines radiating out */}
      <mesh>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshStandardMaterial
          color={region.color}
          transparent
          opacity={hovered ? 0.15 : 0.05}
          wireframe
        />
      </mesh>
    </group>
  );
};

const BrainModel = () => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group ref={groupRef} position={[-2, 0.5, 0]}>
      {/* Brain shape - ellipsoid wireframe */}
      <mesh>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshStandardMaterial
          color="#4dd8e0"
          transparent
          opacity={0.08}
          wireframe
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial
          color="#6c8cff"
          transparent
          opacity={0.05}
        />
      </mesh>
      {/* Neural connections */}
      {REGIONS.map((region) => (
        <BrainRegionNode key={region.name} region={region} />
      ))}
      {/* Central glow */}
      <pointLight color="#4dd8e0" intensity={0.5} distance={3} />
    </group>
  );
};

export default BrainModel;

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const NODE_COUNT = 30;

const NeuralNetwork = () => {
  const groupRef = useRef<THREE.Group>(null);

  const nodes = useMemo(() => {
    return Array.from({ length: NODE_COUNT }, () => ({
      pos: [
        (Math.random() - 0.5) * 12,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
      ] as [number, number, number],
    }));
  }, []);

  const connections = useMemo(() => {
    const lines: { start: [number, number, number]; end: [number, number, number] }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const d = Math.sqrt(
          (nodes[i].pos[0] - nodes[j].pos[0]) ** 2 +
          (nodes[i].pos[1] - nodes[j].pos[1]) ** 2 +
          (nodes[i].pos[2] - nodes[j].pos[2]) ** 2
        );
        if (d < 4) {
          lines.push({ start: nodes[i].pos, end: nodes[j].pos });
        }
      }
    }
    return lines;
  }, [nodes]);

  const linePositions = useMemo(() => {
    const arr = new Float32Array(connections.length * 6);
    connections.forEach((c, i) => {
      arr[i * 6] = c.start[0];
      arr[i * 6 + 1] = c.start[1];
      arr[i * 6 + 2] = c.start[2];
      arr[i * 6 + 3] = c.end[0];
      arr[i * 6 + 4] = c.end[1];
      arr[i * 6 + 5] = c.end[2];
    });
    return arr;
  }, [connections]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.01;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Connection lines */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={connections.length * 2}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#4dd8e0" transparent opacity={0.06} />
      </lineSegments>

      {/* Nodes */}
      {nodes.map((node, i) => (
        <mesh key={i} position={node.pos}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#4dd8e0" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
};

export default NeuralNetwork;

import {useEffect} from 'react';
import {useThree} from '@react-three/fiber';
import {PMREMGenerator} from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Local image-based lighting, so the scene needs no network request for an HDR file. */
export function Env() {
  const {gl, scene} = useThree();
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = tex;
    return () => {
      scene.environment = null;
      tex.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

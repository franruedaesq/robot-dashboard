import { useEffect, useState } from 'react';
import * as ROSLIB from 'roslib';
import RobotDigitalTwin from './RobotDigitalTwin';

function App() {
  const [status, setStatus] = useState('Desconectado 🔴');
  const [ros, setRos] = useState<ROSLIB.Ros | null>(null);

  useEffect(() => {
    const conn = new ROSLIB.Ros({ url: 'ws://localhost:9090' });
    conn.on('connection', () => setStatus('¡Conectado al Cerebro ROS 2! 🟢'));
    conn.on('error', () => setStatus('Error de conexión ⚠️'));
    conn.on('close', () => setStatus('Conexión cerrada ⚪'));
    setRos(conn);
    return () => conn.close();
  }, []);

  const connected = status.includes('🟢');

  return (
    <div style={{
      fontFamily: 'Inter, sans-serif',
      backgroundColor: '#0d0d1a', minHeight: '100vh', color: 'white',
      padding: '16px', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '1.6rem', margin: '0 0 4px' }}>Panel de Control Robótico 🤖</h1>
        <p style={{ fontSize: '0.85rem', color: connected ? '#2ecc71' : '#e74c3c', margin: '0 0 0px', fontWeight: 400 }}>
          Estado ROS: {status}
        </p>
      </div>

      {ros && (
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          <RobotDigitalTwin ros={ros} />
        </div>
      )}
    </div>
  );
}

export default App;

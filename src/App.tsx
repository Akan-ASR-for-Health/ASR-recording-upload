import React, { useState, useEffect } from 'react';
import axios from 'axios';

const App = () => {
  const [data, setData] = useState([]);
  const [recordingStates, setRecordingStates] = useState<{ [key: number]: boolean }>({});
  const [audioBlobs, setAudioBlobs] = useState<{ [key: number]: Blob | null }>({});
  const [loadingStates, setLoadingStates] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    // Fetch data from the GET API
    axios
      .get('https://akan-recorder-backend-y5er.onrender.com/texts/?skip=0&limit=100')
      .then((response) => setData(response.data))
      .catch((error) => console.error('Error fetching data:', error));
  }, []);

  // Start recording audio for a specific row
  const startRecording = async (id: number) => {
    setRecordingStates((prev) => ({ ...prev, [id]: true }));
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (event) => {
      setAudioBlobs((prev) => ({ ...prev, [id]: event.data }));
    };

    mediaRecorder.start();
    setTimeout(() => {
      mediaRecorder.stop();
      setRecordingStates((prev) => ({ ...prev, [id]: false }));
    }, 5000); // Record for 5 seconds
  };

  // Handle PUT request to upload audio for a specific row
  const uploadAudio = async (id: number) => {
    const blob = audioBlobs[id];
    if (!blob) {
      alert('No audio recorded!');
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [id]: true }));
    const formData = new FormData();
    formData.append('file', new File([blob], 'recording.wav'));

    try {
      await axios.put(`https://akan-recorder-backend-y5er.onrender.com/texts/${id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Audio for ID ${id} uploaded successfully!`);
    } catch (error) {
      console.error('Error uploading audio:', error);
      alert(`Failed to upload audio for ID ${id}.`);
    } finally {
      setLoadingStates((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <h1 className="text-3xl font-bold text-center mb-6">Audio Table</h1>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse bg-white shadow-md rounded-lg">
          <thead className="bg-gray-800 text-white">
            <tr>
              <th className="px-4 py-2">ID</th>
              <th className="px-4 py-2">Content</th>
              <th className="px-4 py-2">Translation</th>
              <th className="px-4 py-2">Pre-record</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, index: number) => (
              <tr
                key={item.id}
                className={index % 2 === 0 ? 'bg-gray-50' : 'bg-gray-100'}
              >
                <td className="border px-4 py-2 text-center">{item.id}</td>
                <td className="border px-4 py-2">{item.content}</td>
                <td className="border px-4 py-2">{item.translation}</td>
                <td className="border px-4 py-2">{item.prerecord}</td>
                <td className="border px-4 py-2 text-center">
                  <div className="flex flex-col space-y-2">
                    <button
                      onClick={() => startRecording(item.id)}
                      disabled={recordingStates[item.id]}
                      className={`px-4 py-2 text-sm font-medium rounded-md ${
                        recordingStates[item.id]
                          ? 'bg-gray-400 cursor-not-allowed text-white'
                          : 'bg-blue-500 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {recordingStates[item.id] ? 'Recording...' : 'Record'}
                    </button>
                    <button
                      onClick={() => uploadAudio(item.id)}
                      disabled={loadingStates[item.id] || !audioBlobs[item.id]}
                      className={`px-4 py-2 text-sm font-medium rounded-md ${
                        loadingStates[item.id] || !audioBlobs[item.id]
                          ? 'bg-gray-400 cursor-not-allowed text-white'
                          : 'bg-green-500 hover:bg-green-600 text-white'
                      }`}
                    >
                      {loadingStates[item.id] ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default App;

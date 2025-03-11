import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Mic, Play, Square, Upload,CheckCircle, XCircle } from 'lucide-react';

type DataItem = {
  id: number;
  content: string;
  translation: string;
  prerecord: string;
};

type AudioRecording = {
  blob: Blob;
  url: string;
  timestamp: number;
};

type Notification = {
  type: 'success' | 'error';
  message: string;
  itemId: number;
  timestamp: number;
};

const App = () => {
  const [data, setData] = useState<DataItem[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [recordings, setRecordings] = useState<Map<number, AudioRecording>>(new Map());
  const [isRecording, setIsRecording] = useState<number | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const skip = (currentPage - 1) * itemsPerPage;
        const response = await axios.get<DataItem[]>(
          
          `https://akan-asr-backend-d5ee511bc4b5.herokuapp.com/texts/?skip=${skip}&limit=${itemsPerPage}`
        );
        setData(response.data);
        setHasMore(response.data.length === itemsPerPage);
      } catch (error) {
        setError('Failed to fetch data. Please try again later.');
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage]);

  const addNotification = (type: 'success' | 'error', message: string, itemId: number) => {
    const newNotification = {
      type,
      message,
      itemId,
      timestamp: Date.now(),
    };
    setNotifications(prev => [...prev, newNotification]);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      setNotifications(prev => 
        prev.filter(n => n.timestamp !== newNotification.timestamp)
      );
    }, 3000);
  };

  useEffect(() => {
    return () => {
      // Cleanup function
      recordings.forEach((recording) => URL.revokeObjectURL(recording.url));
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const generateUniqueFileName = (id: number) => {
    const timestamp = new Date().toISOString();
    const randomString = Math.random().toString(36).substring(2, 8);
    return `recording_${id}_${timestamp}_${randomString}.wav`;
  };

  const startRecording = async (id: number) => {
    try {
      if (isRecording) return;
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        setRecordings(prev => new Map(prev).set(id, {
          blob,
          url,
          timestamp: Date.now()
        }));
        setIsRecording(null);
        setRecordingTime(0);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(id);
      
      // Start timer
      let time = 0;
      timerRef.current = window.setInterval(() => {
        time += 1;
        setRecordingTime(time);
        if (time >= 300) { // Max 5 minutes
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      setError('Failed to start recording. Please check your microphone permissions.');
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playRecording = (id: number) => {
    const recording = recordings.get(id);
    if (recording) {
      const audio = new Audio(recording.url);
      audio.play();
    }
  };

  const uploadAudio = async (id: number) => {
    const recording = recordings.get(id);
    if (!recording) {
      setError('No recording found to upload.');
      return;
    }

    setUploading(id);
    setError(null);

    const formData = new FormData();
    const fileName = generateUniqueFileName(id);
    formData.append('file', new File([recording.blob], fileName));

    try {
      await axios.put(
        `https://akan-asr-backend-d5ee511bc4b5.herokuapp.com/texts/${id}/upload`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      // Remove the recording after successful upload
      const newRecordings = new Map(recordings);
      URL.revokeObjectURL(recording.url);
      newRecordings.delete(id);
      setRecordings(newRecordings);
      
      // Add success notification
      addNotification('success', 'Audio uploaded successfully!', id);
    } catch (error) {
      addNotification('error', 'Failed to upload audio. Please try again.', id);
      console.error('Error uploading audio:', error);
    } finally {
      setUploading(null);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
{/* Notifications container */}
<div className="fixed top-4 right-4 z-50">
        {notifications.map((notification) => (
          <div
            key={notification.timestamp}
            className={`flex items-center p-4 mb-2 rounded-lg text-white ${
              notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
            } shadow-lg animate-fade-in`}
          >
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : (
              <XCircle className="h-5 w-5 mr-2" />
            )}
            {notification.message}
          </div>
        ))}
      </div>


      <h1 className="text-3xl font-bold text-center mb-6">Audio Recording Table</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Loading...</span>
        </div>
      ) : (
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
              {data.map((item, index) => (
                <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="border px-4 py-2 text-center">{item.id}</td>
                  <td className="border px-4 py-2">{item.content}</td>
                  <td className="border px-4 py-2">{item.translation}</td>
                  <td className="border px-4 py-2">{item.prerecord}</td>
                  <td className="border px-4 py-2">
                    <div className="flex items-center justify-center space-x-2">
                      {isRecording === item.id ? (
                        <>
                          <span className="text-red-500 animate-pulse mr-2">
                            Recording: {formatTime(recordingTime)}
                          </span>
                          <button
                            onClick={stopRecording}
                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full"
                          >
                            <Square className="h-4 w-4" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startRecording(item.id)}
                          disabled={isRecording !== null}
                          className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-full disabled:bg-gray-400"
                        >
                          <Mic className="h-4 w-4" />
                        </button>
                      )}

                      {recordings.has(item.id) && !isRecording && (
                        <button
                          onClick={() => playRecording(item.id)}
                          className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-full"
                        >
                          <Play className="h-4 w-4" />
                        </button>
                      )}

                      {recordings.has(item.id) && (
                        <button
                          onClick={() => uploadAudio(item.id)}
                          disabled={uploading === item.id}
                          className="bg-purple-500 hover:bg-purple-600 text-white p-2 rounded-full disabled:bg-gray-400"
                        >
                          {uploading === item.id ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setCurrentPage(prev => prev - 1)}
          disabled={currentPage === 1 || loading}
          className="px-4 py-2 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed bg-blue-500 hover:bg-blue-600 text-white"
        >
          Previous
        </button>
        <p className="text-gray-700">Page {currentPage}</p>
        <button
          onClick={() => setCurrentPage(prev => prev + 1)}
          disabled={!hasMore || loading}
          className="px-4 py-2 rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed bg-blue-500 hover:bg-blue-600 text-white"
        >
          Next
        </button>
      </div>
    </div>
  );
};



export default App;
import { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// Debounce function
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

function App() {
  const [notes, setNotes] = useState([]);
  const [selectedNote, setSelectedNote] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
    onUpdate: ({ editor }) => {
      if (selectedNote) {
        const content = editor.getJSON();
        debouncedSave({ ...selectedNote, content });
      }
    },
  });

  // Fetch notes
  const fetchNotes = async (search = "") => {
    try {
      const url = search 
        ? `${BACKEND_URL}/api/search?q=${encodeURIComponent(search)}`
        : `${BACKEND_URL}/api/notes`;
      const response = await fetch(url);
      const data = await response.json();
      setNotes(data);
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setIsLoading(false);
    }
  };

  // Save note
  const saveNote = async (note) => {
    try {
      const method = note.id ? 'PUT' : 'POST';
      const url = note.id 
        ? `${BACKEND_URL}/api/notes/${note.id}`
        : `${BACKEND_URL}/api/notes`;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          content: note.content,
          tags: note.tags || []
        })
      });

      const savedNote = await response.json();
      setNotes(prevNotes => {
        const noteIndex = prevNotes.findIndex(n => n.id === savedNote.id);
        if (noteIndex > -1) {
          return prevNotes.map(n => n.id === savedNote.id ? savedNote : n);
        }
        return [savedNote, ...prevNotes];
      });
      return savedNote;
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const debouncedSave = useCallback(debounce(saveNote, 1000), []);

  // Delete note
  const deleteNote = async (noteId) => {
    try {
      await fetch(`${BACKEND_URL}/api/notes/${noteId}`, { method: 'DELETE' });
      setNotes(prevNotes => prevNotes.filter(note => note.id !== noteId));
      if (selectedNote?.id === noteId) {
        setSelectedNote(null);
        editor?.commands.setContent('');
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  // Create new note
  const createNewNote = async () => {
    const newNote = await saveNote({
      title: 'Untitled Note',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      tags: []
    });
    setSelectedNote(newNote);
    editor?.commands.setContent(newNote.content);
  };

  // Handle note selection
  const selectNote = (note) => {
    setSelectedNote(note);
    editor?.commands.setContent(note.content);
  };

  // Search notes
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    fetchNotes(value);
  };

  // Update note title
  const updateNoteTitle = (e) => {
    if (selectedNote) {
      const updatedNote = { ...selectedNote, title: e.target.value };
      setSelectedNote(updatedNote);
      debouncedSave(updatedNote);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  if (isLoading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <input
            type="text"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={handleSearch}
            className="search-input"
          />
          <button onClick={createNewNote} className="new-note-btn">
            + New Note
          </button>
        </div>
        <div className="notes-list">
          {notes.map(note => (
            <div
              key={note.id}
              className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
              onClick={() => selectNote(note)}
            >
              <div className="note-item-header">
                <h3>{note.title}</h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNote(note.id);
                  }}
                  className="delete-btn"
                >
                  ×
                </button>
              </div>
              <div className="note-preview">
                {note.content.content?.[0]?.content?.[0]?.text || 'Empty note...'}
              </div>
              <div className="note-meta">
                {new Date(note.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="editor-container">
        {selectedNote ? (
          <>
            <input
              type="text"
              value={selectedNote.title}
              onChange={updateNoteTitle}
              className="note-title-input"
            />
            <EditorContent editor={editor} className="editor" />
          </>
        ) : (
          <div className="no-note-selected">
            <h2>Select a note or create a new one</h2>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
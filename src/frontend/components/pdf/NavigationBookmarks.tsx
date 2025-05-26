import React, { useState, useCallback, useEffect } from 'react';
import { Bookmark, BookmarkFolder, ViewportState } from '../../types/navigation';
import { Point, BoundingBox } from '../../types/electrical';

interface NavigationBookmarksProps {
  viewport: ViewportState;
  onViewportChange: (viewport: ViewportState) => void;
  documentBounds: BoundingBox;
  bookmarks: Bookmark[];
  onBookmarksChange: (bookmarks: Bookmark[]) => void;
  folders: BookmarkFolder[];
  onFoldersChange: (folders: BookmarkFolder[]) => void;
  isVisible: boolean;
  onToggleVisibility: () => void;
  currentDocumentId: string;
}

interface BookmarkForm {
  name: string;
  description: string;
  folderId: string | null;
  color: string;
  isPublic: boolean;
}

export const NavigationBookmarks: React.FC<NavigationBookmarksProps> = ({
  viewport,
  onViewportChange,
  documentBounds,
  bookmarks,
  onBookmarksChange,
  folders,
  onFoldersChange,
  isVisible,
  onToggleVisibility,
  currentDocumentId
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<string | null>(null);
  const [bookmarkForm, setBookmarkForm] = useState<BookmarkForm>({
    name: '',
    description: '',
    folderId: null,
    color: '#0099FF',
    isPublic: false
  });
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'folder'>('date');

  const bookmarkColors = [
    '#0099FF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE'
  ];

  const generateId = useCallback((): string => {
    return `bookmark_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }, []);

  const createBookmark = useCallback((formData: BookmarkForm): Bookmark => {
    return {
      id: generateId(),
      name: formData.name || `Bookmark ${bookmarks.length + 1}`,
      description: formData.description,
      viewport: { ...viewport },
      documentId: currentDocumentId,
      folderId: formData.folderId,
      color: formData.color,
      isPublic: formData.isPublic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'current-user', // In real app, get from auth
      tags: [],
      thumbnail: null, // Could generate thumbnail
      viewCount: 0
    };
  }, [viewport, currentDocumentId, bookmarks.length, generateId]);

  const addBookmark = useCallback(() => {
    const newBookmark = createBookmark(bookmarkForm);
    onBookmarksChange([...bookmarks, newBookmark]);
    
    setShowAddForm(false);
    setBookmarkForm({
      name: '',
      description: '',
      folderId: null,
      color: '#0099FF',
      isPublic: false
    });
  }, [bookmarkForm, createBookmark, bookmarks, onBookmarksChange]);

  const updateBookmark = useCallback((id: string, updates: Partial<Bookmark>) => {
    const updatedBookmarks = bookmarks.map(bookmark => 
      bookmark.id === id 
        ? { ...bookmark, ...updates, updatedAt: new Date().toISOString() }
        : bookmark
    );
    onBookmarksChange(updatedBookmarks);
  }, [bookmarks, onBookmarksChange]);

  const deleteBookmark = useCallback((id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this bookmark?');
    if (confirmed) {
      onBookmarksChange(bookmarks.filter(b => b.id !== id));
    }
  }, [bookmarks, onBookmarksChange]);

  const navigateToBookmark = useCallback((bookmark: Bookmark) => {
    onViewportChange(bookmark.viewport);
    
    // Increment view count
    updateBookmark(bookmark.id, { viewCount: bookmark.viewCount + 1 });
  }, [onViewportChange, updateBookmark]);

  const createFolder = useCallback((name: string, parentId: string | null = null) => {
    const newFolder: BookmarkFolder = {
      id: generateId(),
      name,
      parentId,
      color: bookmarkColors[folders.length % bookmarkColors.length],
      isExpanded: true,
      createdAt: new Date().toISOString(),
      createdBy: 'current-user'
    };
    
    onFoldersChange([...folders, newFolder]);
    setExpandedFolders(prev => new Set([...prev, newFolder.id]));
  }, [folders, onFoldersChange, generateId]);

  const deleteFolder = useCallback((id: string) => {
    // Move bookmarks to root level
    const updatedBookmarks = bookmarks.map(bookmark =>
      bookmark.folderId === id ? { ...bookmark, folderId: null } : bookmark
    );
    onBookmarksChange(updatedBookmarks);
    
    // Remove folder
    onFoldersChange(folders.filter(f => f.id !== id));
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, [bookmarks, folders, onBookmarksChange, onFoldersChange]);

  const toggleFolder = useCallback((id: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const filterBookmarks = useCallback((bookmarks: Bookmark[]): Bookmark[] => {
    let filtered = bookmarks;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(bookmark =>
        bookmark.name.toLowerCase().includes(query) ||
        bookmark.description?.toLowerCase().includes(query) ||
        bookmark.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Filter by selected folder
    if (selectedFolderId) {
      filtered = filtered.filter(bookmark => bookmark.folderId === selectedFolderId);
    }

    // Sort bookmarks
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'folder':
          const aFolder = folders.find(f => f.id === a.folderId)?.name || 'Root';
          const bFolder = folders.find(f => f.id === b.folderId)?.name || 'Root';
          return aFolder.localeCompare(bFolder);
        default:
          return 0;
      }
    });

    return filtered;
  }, [searchQuery, selectedFolderId, sortBy, folders]);

  const exportBookmarks = useCallback(() => {
    const exportData = {
      bookmarks,
      folders,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bookmarks_${currentDocumentId}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [bookmarks, folders, currentDocumentId]);

  const importBookmarks = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (data.bookmarks && data.folders) {
          onBookmarksChange([...bookmarks, ...data.bookmarks]);
          onFoldersChange([...folders, ...data.folders]);
        }
      } catch (error) {
        console.error('Failed to import bookmarks:', error);
        alert('Failed to import bookmarks. Please check the file format.');
      }
    };
    reader.readAsText(file);
  }, [bookmarks, folders, onBookmarksChange, onFoldersChange]);

  const renderFolder = useCallback((folder: BookmarkFolder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderBookmarks = bookmarks.filter(b => b.folderId === folder.id);
    const subFolders = folders.filter(f => f.parentId === folder.id);

    return (
      <div key={folder.id} className="folder-item" style={{ marginLeft: level * 20 }}>
        <div className="folder-header">
          <button
            onClick={() => toggleFolder(folder.id)}
            className="folder-toggle"
          >
            {isExpanded ? '📂' : '📁'}
          </button>
          <span className="folder-name">{folder.name}</span>
          <span className="bookmark-count">({folderBookmarks.length})</span>
          <div className="folder-actions">
            <button
              onClick={() => setSelectedFolderId(selectedFolderId === folder.id ? null : folder.id)}
              className={`filter-btn ${selectedFolderId === folder.id ? 'active' : ''}`}
              title="Filter by folder"
            >
              🔍
            </button>
            <button
              onClick={() => deleteFolder(folder.id)}
              className="delete-btn"
              title="Delete folder"
            >
              🗑️
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className="folder-content">
            {subFolders.map(subFolder => renderFolder(subFolder, level + 1))}
            {folderBookmarks.map(bookmark => (
              <div key={bookmark.id} className="bookmark-item nested">
                <div
                  className="bookmark-color"
                  style={{ backgroundColor: bookmark.color }}
                />
                <div className="bookmark-info">
                  <div className="bookmark-name">{bookmark.name}</div>
                  {bookmark.description && (
                    <div className="bookmark-description">{bookmark.description}</div>
                  )}
                  <div className="bookmark-meta">
                    <span className="view-count">👁️ {bookmark.viewCount}</span>
                    <span className="created-date">
                      {new Date(bookmark.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="bookmark-actions">
                  <button
                    onClick={() => navigateToBookmark(bookmark)}
                    className="navigate-btn"
                    title="Go to bookmark"
                  >
                    📍
                  </button>
                  <button
                    onClick={() => setEditingBookmark(bookmark.id)}
                    className="edit-btn"
                    title="Edit bookmark"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteBookmark(bookmark.id)}
                    className="delete-btn"
                    title="Delete bookmark"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [
    expandedFolders,
    bookmarks,
    folders,
    selectedFolderId,
    toggleFolder,
    setSelectedFolderId,
    deleteFolder,
    navigateToBookmark,
    setEditingBookmark,
    deleteBookmark
  ]);

  if (!isVisible) {
    return (
      <button 
        onClick={onToggleVisibility}
        className="bookmarks-toggle collapsed"
        title="Show bookmarks"
      >
        🔖 ({bookmarks.length})
      </button>
    );
  }

  return (
    <div className="navigation-bookmarks">
      {/* Header */}
      <div className="bookmarks-header">
        <h4>Bookmarks</h4>
        <div className="header-actions">
          <button
            onClick={() => setShowAddForm(true)}
            className="add-bookmark-btn"
            title="Add bookmark"
          >
            ➕
          </button>
          <button onClick={onToggleVisibility} className="close-btn">✕</button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <button
          onClick={() => {
            const newBookmark = createBookmark({
              name: `Quick Bookmark ${bookmarks.length + 1}`,
              description: '',
              folderId: null,
              color: bookmarkColors[0],
              isPublic: false
            });
            onBookmarksChange([...bookmarks, newBookmark]);
          }}
          className="quick-bookmark-btn"
        >
          🔖 Quick Bookmark
        </button>
      </div>

      {/* Add Bookmark Form */}
      {showAddForm && (
        <div className="add-bookmark-form">
          <h5>Add Bookmark</h5>
          <div className="form-fields">
            <input
              type="text"
              value={bookmarkForm.name}
              onChange={(e) => setBookmarkForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Bookmark name"
              className="form-input"
            />
            <textarea
              value={bookmarkForm.description}
              onChange={(e) => setBookmarkForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description (optional)"
              className="form-textarea"
              rows={2}
            />
            <select
              value={bookmarkForm.folderId || ''}
              onChange={(e) => setBookmarkForm(prev => ({ 
                ...prev, 
                folderId: e.target.value || null 
              }))}
              className="form-select"
            >
              <option value="">No folder</option>
              {folders.map(folder => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <div className="color-picker">
              <label>Color:</label>
              <div className="color-options">
                {bookmarkColors.map(color => (
                  <button
                    key={color}
                    className={`color-option ${bookmarkForm.color === color ? 'selected' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setBookmarkForm(prev => ({ ...prev, color }))}
                  />
                ))}
              </div>
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={bookmarkForm.isPublic}
                onChange={(e) => setBookmarkForm(prev => ({ ...prev, isPublic: e.target.checked }))}
              />
              Make public
            </label>
          </div>
          <div className="form-actions">
            <button onClick={addBookmark} className="save-btn">Save</button>
            <button onClick={() => setShowAddForm(false)} className="cancel-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="search-filter">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search bookmarks..."
          className="search-input"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="sort-select"
        >
          <option value="date">Sort by Date</option>
          <option value="name">Sort by Name</option>
          <option value="folder">Sort by Folder</option>
        </select>
      </div>

      {/* Folder Management */}
      <div className="folder-management">
        <div className="folder-header">
          <h5>Folders</h5>
          <button
            onClick={() => {
              const name = prompt('Folder name:');
              if (name) createFolder(name);
            }}
            className="add-folder-btn"
            title="Add folder"
          >
            ➕
          </button>
        </div>
        
        {selectedFolderId && (
          <div className="active-filter">
            <span>Filtered by: {folders.find(f => f.id === selectedFolderId)?.name}</span>
            <button onClick={() => setSelectedFolderId(null)} className="clear-filter-btn">
              ✕
            </button>
          </div>
        )}

        <div className="folder-tree">
          {folders.filter(f => !f.parentId).map(folder => renderFolder(folder))}
        </div>
      </div>

      {/* Bookmarks List */}
      <div className="bookmarks-list">
        <h5>
          Bookmarks ({filterBookmarks(bookmarks).length})
          {searchQuery && ` matching "${searchQuery}"`}
        </h5>
        
        {filterBookmarks(bookmarks).length > 0 ? (
          <div className="bookmark-items">
            {filterBookmarks(bookmarks).map(bookmark => (
              <div key={bookmark.id} className="bookmark-item">
                <div
                  className="bookmark-color"
                  style={{ backgroundColor: bookmark.color }}
                />
                <div className="bookmark-info">
                  <div className="bookmark-name">{bookmark.name}</div>
                  {bookmark.description && (
                    <div className="bookmark-description">{bookmark.description}</div>
                  )}
                  <div className="bookmark-meta">
                    <span className="view-count">👁️ {bookmark.viewCount}</span>
                    <span className="zoom-level">
                      🔍 {(bookmark.viewport.scale * 100).toFixed(0)}%
                    </span>
                    <span className="created-date">
                      {new Date(bookmark.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {bookmark.tags && bookmark.tags.length > 0 && (
                    <div className="bookmark-tags">
                      {bookmark.tags.map(tag => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="bookmark-actions">
                  <button
                    onClick={() => navigateToBookmark(bookmark)}
                    className="navigate-btn"
                    title="Go to bookmark"
                  >
                    📍
                  </button>
                  <button
                    onClick={() => setEditingBookmark(bookmark.id)}
                    className="edit-btn"
                    title="Edit bookmark"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteBookmark(bookmark.id)}
                    className="delete-btn"
                    title="Delete bookmark"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-bookmarks">
            <div className="no-bookmarks-icon">🔖</div>
            <div className="no-bookmarks-text">
              {searchQuery ? 'No bookmarks match your search' : 'No bookmarks yet'}
            </div>
            {!searchQuery && (
              <button
                onClick={() => setShowAddForm(true)}
                className="add-first-bookmark-btn"
              >
                Add your first bookmark
              </button>
            )}
          </div>
        )}
      </div>

      {/* Import/Export */}
      <div className="import-export">
        <h5>Import/Export</h5>
        <div className="import-export-actions">
          <button onClick={exportBookmarks} className="export-btn">
            📤 Export
          </button>
          <label className="import-btn">
            📥 Import
            <input
              type="file"
              accept=".json"
              onChange={importBookmarks}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {/* Statistics */}
      <div className="bookmark-stats">
        <h5>Statistics</h5>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Bookmarks:</span>
            <span className="stat-value">{bookmarks.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Folders:</span>
            <span className="stat-value">{folders.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Most Used:</span>
            <span className="stat-value">
              {bookmarks.length > 0
                ? bookmarks.reduce((max, b) => b.viewCount > max.viewCount ? b : max).name
                : 'None'
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
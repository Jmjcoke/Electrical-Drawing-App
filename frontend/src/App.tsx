import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Container, Typography, Box, Paper } from '@mui/material';
import FileUpload from './components/upload/FileUpload';
import type { UploadResponse } from './types/api';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  typography: {
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
  },
});

function App() {
  const handleUploadSuccess = (response: UploadResponse) => {
    console.log('Upload successful:', response);
    // TODO: Navigate to analysis view or show success state
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // Error is already displayed in the FileUpload component
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          <Typography variant="h1" component="h1" gutterBottom align="center">
            Electrical Drawing Analysis
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 4 }}>
            Upload your electrical drawing PDF to begin AI-powered analysis
          </Typography>
          
          <Paper elevation={2} sx={{ p: 3 }}>
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          </Paper>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
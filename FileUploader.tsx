const uploadPart = async (
  presignedUrl: string,
  chunk: Blob,
  partNumber: number
): Promise<string> => {
  try {
    console.log(`Uploading part ${partNumber} to ${presignedUrl}`);
    
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: chunk,
      mode: 'cors',
      credentials: 'omit',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Log all response headers for debugging
    console.log('Response headers:', Array.from(response.headers.entries()));
    
    // Try to get ETag from response headers (case insensitive)
    const etag = response.headers.get('etag') || 
                 response.headers.get('ETag') || 
                 response.headers.get('x-amz-etag');
                 
    if (!etag) {
      throw new Error(`No ETag in response for part ${partNumber}`);
    }

    console.log(`Successfully uploaded part ${partNumber}, ETag: ${etag}`);
    return etag;
  } catch (error) {
    console.error(`Error uploading part ${partNumber}:`, error);
    throw error;
  }
}; 
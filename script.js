// script.js - Clean client-side version with Facebook compatibility

const canvas = document.getElementById('editor');
const ctx = canvas.getContext('2d');
const SIZE = 1080;

const fileInput = document.getElementById('fileInput');
const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const copyCaptionBtn = document.getElementById('copyCaption');
const captionText = document.getElementById('captionText');
const frameOverlay = document.querySelector('.frame-overlay');

let scale = 1;
let tx = 0;
let ty = 0;
let lastX = 0;
let lastY = 0;
let isPointerDown = false;
const pointers = new Map();

const frameImg = new Image();
frameImg.src = 'assets/frame.png';
let userImg = null;

canvas.width = SIZE;
canvas.height = SIZE;

// Frame loading handlers
frameImg.onload = () => {
    frameOverlay.style.backgroundImage = `url('${frameImg.src}')`;
    draw();
};

frameImg.onerror = () => {
    console.error('Failed to load frame.png');
    alert('Error: Frame image not found. Please check that assets/frame.png exists.');
};

// Draw function
function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    
    if (userImg) {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.scale(scale, scale);
        
        const imgAspect = userImg.width / userImg.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > 1) {
            drawWidth = SIZE;
            drawHeight = SIZE / imgAspect;
            offsetX = 0;
            offsetY = (SIZE - drawHeight) / 2;
        } else {
            drawWidth = SIZE * imgAspect;
            drawHeight = SIZE;
            offsetX = (SIZE - drawWidth) / 2;
            offsetY = 0;
        }
        
        ctx.drawImage(userImg, 0, 0, userImg.width, userImg.height, offsetX, offsetY, drawWidth, drawHeight);
        ctx.restore();
    }
}

// File upload handler
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        alert('Please upload a valid image file (JPG, PNG, etc.)');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
        userImg = new Image();
        userImg.onload = () => {
            scale = 1;
            tx = 0;
            ty = 0;
            downloadBtn.disabled = false;
            draw();
        };
        userImg.onerror = () => {
            alert('Failed to load image. Please try a different file.');
        };
        userImg.src = event.target.result;
    };
    reader.onerror = () => {
        alert('Failed to read file. Please try again.');
    };
    reader.readAsDataURL(file);
});

// Touch/Pointer events for pan and zoom
canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    isPointerDown = true;
    lastX = e.clientX;
    lastY = e.clientY;
});

canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Single pointer = pan
    if (pointers.size === 1 && isPointerDown) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        tx += dx;
        ty += dy;
        lastX = e.clientX;
        lastY = e.clientY;
        draw();
    } 
    // Two pointers = pinch zoom
    else if (pointers.size === 2) {
        const it = Array.from(pointers.values());
        const [p1, p2] = it;
        const curDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

        if (typeof canvas._lastPinchDist === 'number') {
            const delta = curDist - canvas._lastPinchDist;
            const zoomFactor = 1 + delta / 500;
            const rect = canvas.getBoundingClientRect();
            const centerX = ((p1.x + p2.x) / 2 - rect.left) * (SIZE / rect.width);
            const centerY = ((p1.y + p2.y) / 2 - rect.top) * (SIZE / rect.height);
            const beforeX = (centerX - tx) / scale;
            const beforeY = (centerY - ty) / scale;

            scale *= zoomFactor;
            scale = Math.max(0.1, Math.min(10, scale));

            const afterX = beforeX * scale + tx;
            const afterY = beforeY * scale + ty;
            tx += (centerX - afterX);
            ty += (centerY - afterY);
            draw();
        }
        canvas._lastPinchDist = curDist;
    }
});

canvas.addEventListener('pointerup', (e) => { 
    canvas.releasePointerCapture(e.pointerId); 
    pointers.delete(e.pointerId); 
    isPointerDown = false; 
    canvas._lastPinchDist = undefined; 
});

canvas.addEventListener('pointercancel', (e) => { 
    pointers.delete(e.pointerId); 
    isPointerDown = false; 
    canvas._lastPinchDist = undefined; 
});

// Mouse wheel zoom
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY;
    const zoomFactor = 1 + delta * 0.0015;
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (SIZE / rect.width);
    const cy = (e.clientY - rect.top) * (SIZE / rect.height);
    const imgX = (cx - tx) / scale;
    const imgY = (cy - ty) / scale;
    scale *= zoomFactor;
    scale = Math.max(0.1, Math.min(10, scale));
    tx = cx - imgX * scale;
    ty = cy - imgY * scale;
    draw();
}, { passive: false });

// Reset button
resetBtn.addEventListener('click', () => {
    if (userImg) {
        scale = 1;
        tx = 0;
        ty = 0;
        draw();
    }
});

// DOWNLOAD with multiple fallback methods
downloadBtn.addEventListener('click', async () => {
    if (!userImg) {
        alert('Please upload an image first!');
        return;
    }
    
    if (!frameImg.complete || frameImg.naturalHeight === 0) {
        alert('Frame is still loading. Please wait a moment and try again.');
        return;
    }
    
    // Show processing state
    const originalText = downloadBtn.textContent;
    downloadBtn.textContent = 'Processing...';
    downloadBtn.disabled = true;
    
    try {
        // Create temporary canvas with final composition
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = SIZE;
        tempCanvas.height = SIZE;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw user image with transformations
        tempCtx.save();
        tempCtx.translate(tx, ty);
        tempCtx.scale(scale, scale);
        
        const imgAspect = userImg.width / userImg.height;
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (imgAspect > 1) {
            drawWidth = SIZE;
            drawHeight = SIZE / imgAspect;
            offsetX = 0;
            offsetY = (SIZE - drawHeight) / 2;
        } else {
            drawWidth = SIZE * imgAspect;
            drawHeight = SIZE;
            offsetX = (SIZE - drawWidth) / 2;
            offsetY = 0;
        }
        
        tempCtx.drawImage(userImg, 0, 0, userImg.width, userImg.height, offsetX, offsetY, drawWidth, drawHeight);
        tempCtx.restore();
        
        // Draw frame on top
        tempCtx.drawImage(frameImg, 0, 0, SIZE, SIZE);
        
        // Try download with fallback methods
        let downloadSuccess = false;
        
        // Method 1: Try toBlob (best quality, most compatible)
        try {
            await new Promise((resolve, reject) => {
                tempCanvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Blob creation failed'));
                        return;
                    }
                    
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'lighttheworld-davao-framed.png';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    
                    setTimeout(() => {
                        URL.revokeObjectURL(url);
                        resolve();
                    }, 100);
                }, 'image/png', 1.0);
            });
            downloadSuccess = true;
            console.log('Download via blob succeeded');
        } catch (blobError) {
            console.log('Blob method failed:', blobError);
            
            // Method 2: Try toDataURL (better Facebook compatibility)
            try {
                const dataURL = tempCanvas.toDataURL('image/png', 1.0);
                const a = document.createElement('a');
                a.href = dataURL;
                a.download = 'lighttheworld-davao-framed.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                downloadSuccess = true;
                console.log('Download via dataURL succeeded');
            } catch (dataURLError) {
                console.log('DataURL method failed:', dataURLError);
                
                // Method 3: Open in new window (last resort)
                const dataURL = tempCanvas.toDataURL('image/png', 1.0);
                const win = window.open('', '_blank');
                if (win) {
                    win.document.write(`
                        <!DOCTYPE html>
                        <html>
                        <head>
                            <meta charset="utf-8">
                            <meta name="viewport" content="width=device-width, initial-scale=1">
                            <title>Light the World - Your Framed Photo</title>
                            <style>
                                body {
                                    margin: 0;
                                    padding: 20px;
                                    background: #f5f5f5;
                                    font-family: system-ui, sans-serif;
                                    text-align: center;
                                }
                                .container {
                                    max-width: 800px;
                                    margin: 0 auto;
                                }
                                img {
                                    max-width: 100%;
                                    height: auto;
                                    border: 1px solid #ddd;
                                    border-radius: 8px;
                                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                }
                                .instructions {
                                    background: #fff;
                                    padding: 20px;
                                    border-radius: 8px;
                                    margin-bottom: 20px;
                                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                                }
                                .btn {
                                    display: inline-block;
                                    padding: 12px 24px;
                                    background: #f6c84c;
                                    color: #333;
                                    text-decoration: none;
                                    border-radius: 8px;
                                    font-weight: bold;
                                    margin: 10px;
                                }
                            </style>
                        </head>
                        <body>
                            <div class="container">
                                <div class="instructions">
                                    <h2>Your Light the World Framed Photo</h2>
                                    <p><strong>To save on mobile:</strong> Long-press the image below and select "Save Image" or "Add to Photos"</p>
                                    <p><strong>To save on desktop:</strong> Right-click the image and select "Save Image As..."</p>
                                </div>
                                <img src="${dataURL}" alt="Your framed photo" />
                                <br>
                                <a href="${dataURL}" download="lighttheworld-davao-framed.png" class="btn">Try Download Button</a>
                            </div>
                        </body>
                        </html>
                    `);
                    downloadSuccess = true;
                    console.log('Opened in new window');
                } else {
                    console.error('Failed to open new window');
                }
            }
        }
        
        if (!downloadSuccess) {
            throw new Error('All download methods failed');
        }
        
    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed. Please try:\n\n1. Opening this link in Chrome or Safari (not Facebook browser)\n2. Taking a screenshot of the framed image\n\nError: ' + error.message);
    } finally {
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;
    }
});

// Copy caption
copyCaptionBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(captionText.value);
        copyCaptionBtn.textContent = 'Copied! ✓';
        setTimeout(() => copyCaptionBtn.textContent = 'Copy caption', 2000);
    } catch (err) {
        // Fallback for older browsers
        try {
            captionText.select();
            captionText.setSelectionRange(0, 99999);
            document.execCommand('copy');
            copyCaptionBtn.textContent = 'Copied! ✓';
            setTimeout(() => copyCaptionBtn.textContent = 'Copy caption', 2000);
        } catch (e) {
            alert('Unable to copy automatically. Please select the text and copy manually (Ctrl+C or Cmd+C)');
        }
    }
});

// Initial draw
draw();
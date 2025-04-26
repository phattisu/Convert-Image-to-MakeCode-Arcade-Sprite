
let mode = "full-width";
// https://makecode.com/_EvPP98M4pYEC

/**
 * To do:
 *
 * 1. Implement "fit", "fill" - Current code mostly handles scaling, but not "fill" (cropping/letterboxing)
 * 2. Black and white mode - New feature
 * 3. Other cool effects - New features
 * 4. Shuffle colors - New feature
 */

const canvas = document.querySelector("canvas"); // This canvas will be used for scaled preview and getting pixel data
const copyButton = document.querySelector("button#copy");
const runButton = document.querySelector("button#run");
const customSizes = document.querySelectorAll("input[type='number'].custom");
const fileInput = document.querySelector("input#myFile");
const form = document.querySelector("form");
const numberInputs = document.querySelectorAll("input[type='number']");
const radioButtons = document.querySelectorAll("input[type='radio']");
const colorPicks = document.querySelectorAll("input.colorpicker[type='color']");
const colorTexts = document.querySelectorAll("input.colortext[type='text']");
const scaleFactor = document.querySelector("input[type='number']#factor");
const textarea = document.querySelector("textarea");

let originalImageSize = { width: 0, height: 0 };
let currentImageType = 'static'; // 'static' or 'gif'
let gifFramesData = null; // Store processed GIF frames data

function isValidHex(hex) {
    return /^#([0-9A-Fa-f]{6})$/.test(hex);
}

function syncColorToText(colorInput) {
    colorTexts.forEach(textInput => {
        if (textInput.id === colorInput.id) {
            textInput.value = colorInput.value;
        }
    });
}

function syncTextToColor(textInput) {
    colorPicks.forEach(colorInput => {
        if (colorInput.id === textInput.id) {
            if (isValidHex(textInput.value)) {
                colorInput.value = textInput.value;
            } else {
                // Revert to color picker value if text is invalid hex
                textInput.value = colorInput.value;
            }
        }
    });
}

colorPicks.forEach(colorInput => {
    colorInput.addEventListener("change", function() {
        syncColorToText(colorInput);
        // Re-run conversion when color changes
        if (fileInput.files.length > 0) {
            processImage();
        }
    });
});

colorTexts.forEach(textInput => {
    textInput.addEventListener("change", function() {
        syncTextToColor(textInput);
        // Re-run conversion when color changes
         if (fileInput.files.length > 0) {
            processImage();
        }
    });
});

// Function to get the current palette from color pickers
function getCurrentPalette() {
    const palette = ["#00000000"]; // Transparent is always first
    for (let i = 1; i <= 15; i++) {
        palette.push(document.getElementById('col' + i).value);
    }
    return palette.map(function convertFromHexToRGB(color, index) {
        // Handle the transparent case
        if (color === "#00000000") {
             // Use alpha for transparency, r, g, b can be anything
             return { color: { r: 0, g: 0, b: 0, a: 0 }, index: (index).toString(16) };
        }
        const r = parseInt(color[1] + color[2], 16);
        const g = parseInt(color[3] + color[4], 16);
        const b = parseInt(color[5] + color[6], 16);
        // Assume full opacity for non-transparent colors
        return { color: { r, g, b, a: 255 }, index: (index).toString(16) };
    });
}


// Function to find the nearest color in the palette
function findNearestColor(r, g, b, a, palette) {
    let nearest = palette[0]; // Default to transparent

    // If pixel is fully transparent, return transparent index (0)
    if (a === 0) {
        return palette[0];
    }

    let minDiff = Infinity;

    // Iterate through the palette (excluding transparent)
    for (let i = 1; i < palette.length; i++) {
        const pColor = palette[i].color;
        const rDiff = Math.abs(pColor.r - r);
        const gDiff = Math.abs(pColor.g - g);
        const bDiff = Math.abs(pColor.b - b);
        const diff = rDiff + gDiff + bDiff; // Simple sum of differences

        if (diff < minDiff) {
            minDiff = diff;
            nearest = palette[i];
        }
    }
     // If the nearest is still the initial transparent and minDiff is huge,
     // it means the pixel was not fully transparent but very dark/close to black.
     // The check `if (a === 0)` handles true transparency.
     // For non-transparent pixels, we always find the closest non-transparent color (or black 'f' if it's in the palette).
    return nearest;
}

// Function to process pixel data from a canvas and return MakeCode bitmap string
function processFramePixels(pixelData, width, height, palette) {
    let makeCodeString = {};
    let pixelIndex = 0;

    for (let i = 0; i < pixelData.length; i += 4) {
        const x = pixelIndex % width;
        const y = Math.floor(pixelIndex / width);

        const r = pixelData[i + 0];
        const g = pixelData[i + 1];
        const b = pixelData[i + 2];
        const a = pixelData[i + 3];

        const nearest = findNearestColor(r, g, b, a, palette);

        if (makeCodeString[`row-${y}`] === undefined) {
            makeCodeString[`row-${y}`] = "";
        }

        // MakeCode uses '0' for transparent and '1'-'f' for colors.
        // Our palette index 0 is transparent.
        makeCodeString[`row-${y}`] += nearest.index === '0' ? '0' : nearest.index;

        pixelIndex++;
    }

    // Construct the final bitmap string
    let bitmapString = "";
    for (let y = 0; y < height; y++) {
        bitmapString += makeCodeString[`row-${y}`] + (y < height - 1 ? "\n" : "");
    }
    return bitmapString;
}

// Function to generate MakeCode animation code
function generateMakeCodeAnimation(framesData, width, height) {
    let dateString = new Date()
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replaceAll(".", "");

    let code = `let animationFrames${dateString} = [\n`;
    framesData.forEach((frame, index) => {
        code += `    img\`\n${frame.bitmap}\n    \`${index < framesData.length - 1 ? ',' : ''}\n`;
    });
    code += `];\n`;

    // MakeCode animation delays are in ms, GIF delays are in 1/100ths of a second
    let delays = framesData.map(frame => Math.max(1, frame.delay * 10)); // Minimum 1ms delay

    code += `let frameDelays${dateString} = [${delays.join(', ')}];\n`;
    code += `let myAnimatedSprite${dateString} = sprites.create(animationFrames${dateString}[0], SpriteKind.Player);\n`;
    code += `animation.runImageAnimation(myAnimatedSprite${dateString}, animationFrames${dateString}, frameDelays${dateString}, true); // true for looping\n`; // Assume looping

    return code;
}

// Function to generate MakeCode static sprite code
function generateMakeCodeSprite(bitmap, width, height) {
    let dateString = new Date()
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replaceAll(".", "");
    let code = `let mySprite${dateString} = sprites.create(img\`\n${bitmap}\n\`, SpriteKind.Player);\n`;
    return code;
}


// Function to calculate target dimensions based on mode and original size
function calculateTargetDimensions(originalWidth, originalHeight, mode) {
     let targetWidth = originalWidth;
     let targetHeight = originalHeight;

     if (mode === "custom") {
         let customWidthInput = document.querySelector(".custom#width");
         let customHeightInput = document.querySelector(".custom#height");
         let customWidth = parseInt(customWidthInput.value, 10);
         let customHeight = parseInt(customHeightInput.value, 10);

         const isWidthValid = !isNaN(customWidth) && customWidth > 0;
         const isHeightValid = !isNaN(customHeight) && customHeight > 0;

         if (isWidthValid && !isHeightValid) {
             const factor = customWidth / originalWidth;
             targetWidth = customWidth;
             targetHeight = Math.round(originalHeight * factor);
         } else if (!isWidthValid && isHeightValid) {
             const factor = customHeight / originalHeight;
             targetWidth = Math.round(originalWidth * factor);
             targetHeight = customHeight;
         } else if (isWidthValid && isHeightValid) {
             targetWidth = customWidth;
             targetHeight = customHeight;
         } else {
             // If custom inputs are invalid, default to original size
             console.warn("Invalid custom dimensions, using original size.");
         }

     } else if (mode === "scale") {
         const factorInput = document.querySelector("input#factor");
         const factor = parseFloat(factorInput.value);
         if (!isNaN(factor) && factor > 0) {
             targetWidth = Math.round(originalWidth * factor);
             targetHeight = Math.round(originalHeight * factor);
         } else {
             // If factor is invalid, default to original size
              console.warn("Invalid scale factor, using original size.");
         }
     } else if (mode === "full-width") {
         const maxWidth = 160; // MakeCode Arcade screen width
         const factor = maxWidth / originalWidth;
         targetWidth = maxWidth;
         targetHeight = Math.round(originalHeight * factor);
     } else if (mode === "full-height") {
         const maxHeight = 120; // MakeCode Arcade screen height
         const factor = maxHeight / originalHeight;
         targetWidth = Math.round(originalWidth * factor);
         targetHeight = maxHeight;
     }
     // For "original" mode, targetWidth and targetHeight are already set to originalImageSize

     // Ensure dimensions are positive integers
     targetWidth = Math.max(1, Math.round(targetWidth));
     targetHeight = Math.max(1, Math.round(targetHeight));

     return { width: targetWidth, height: targetHeight };
}


// Main function to process the uploaded image (static or GIF)
async function processImage() {
    const file = fileInput.files[0];
    if (!file) return;

    copyButton.innerText = "Copy code"; // Reset text
    copyButton.disabled = true; // Disable until processing is done
    textarea.textContent = "Processing...";

    const reader = new FileReader();

    reader.onload = async function(event) {
        const arrayBuffer = event.target.result;
        const palette = getCurrentPalette(); // Get current palette

        if (file.type === 'image/gif') {
            currentImageType = 'gif';
            try {
                const gif = new Gifuct(arrayBuffer);
                const frames = gif.decompressFrames(true);

                if (!frames || frames.length === 0) {
                     textarea.textContent = "Error: Could not extract GIF frames.";
                     return;
                }

                // Get original GIF dimensions from header
                originalImageSize = { width: gif.width, height: gif.height };

                // Calculate target dimensions based on selected mode
                const targetDimensions = calculateTargetDimensions(originalImageSize.width, originalImageSize.height, mode);

                // Use the main canvas for rendering scaled frames and getting pixel data
                const renderCanvas = canvas; // Reuse the existing canvas element
                const renderCtx = renderCanvas.getContext('2d');

                // Create a hidden canvas to handle drawing frames at original GIF size
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                tempCanvas.width = originalImageSize.width;
                tempCanvas.height = originalImageSize.height;


                gifFramesData = []; // Reset stored GIF data

                // Process each frame
                for (let i = 0; i < frames.length; i++) {
                    const frame = frames[i];

                    // Handle disposal - Basic approach: clear canvas if disposal 2
                    if (frame.disposalType === 2) {
                        tempCtx.clearRect(0, 0, originalImageSize.width, originalImageSize.height);
                    }
                    // Disposal type 1 (do not dispose) and 3 (restore to previous)
                    // are complex and require keeping track of previous states.
                    // For simplicity, we'll just draw over the existing content.
                    // A more accurate implementation would involve drawing the patch
                    // onto a canvas representing the previous frame's state.

                    // Draw the frame's patch data onto the temporary canvas (original size)
                    const frameImageData = new ImageData(
                        new Uint8ClampedArray(frame.patch),
                        frame.dims.width,
                        frame.dims.height
                    );
                    tempCtx.putImageData(frameImageData, frame.dims.left, frame.dims.top);

                    // Now draw the temporary canvas (original size) onto the main canvas (scaled size)
                    renderCanvas.width = targetDimensions.width;
                    renderCanvas.height = targetDimensions.height;
                    renderCtx.clearRect(0, 0, targetDimensions.width, targetDimensions.height); // Clear scaled canvas
                    renderCtx.drawImage(
                        tempCanvas, // Source canvas (original size)
                        0, 0, originalImageSize.width, originalImageSize.height, // Source rectangle
                        0, 0, targetDimensions.width, targetDimensions.height // Destination rectangle (scaled size)
                    );

                    // Get pixel data from the scaled canvas
                    const scaledFrameData = renderCtx.getImageData(0, 0, targetDimensions.width, targetDimensions.height).data;

                    // Process scaled frame pixels into bitmap
                    const bitmap = processFramePixels(scaledFrameData, targetDimensions.width, targetDimensions.height, palette);

                    gifFramesData.push({
                        bitmap: bitmap,
                        // MakeCode animation delays are in ms, GIF delays are in 1/100ths of a second
                        // Ensure minimum delay is not 0
                        delay: Math.max(10, frame.delay * 10) // Use at least 10ms delay if GIF delay is very small
                    });
                     textarea.textContent = `Processing frame ${i + 1}/${frames.length}...`;
                }

                // After processing all frames, generate MakeCode animation code
                const makeCode = generateMakeCodeAnimation(gifFramesData, targetDimensions.width, targetDimensions.height);
                textarea.textContent = makeCode;

                 // Draw the first frame on the preview canvas after processing
                 renderCanvas.width = targetDimensions.width;
                 renderCanvas.height = targetDimensions.height;
                 renderCtx.clearRect(0, 0, targetDimensions.width, targetDimensions.height);
                 // Redraw the first frame specifically for preview
                 const firstFramePatch = new ImageData(
                     new Uint8ClampedArray(frames[0].patch),
                     frames[0].dims.width,
                     frames[0].dims.height
                 );
                 // Need to reconstruct the first frame onto tempCanvas then draw scaled
                 tempCtx.clearRect(0, 0, originalImageSize.width, originalImageSize.height); // Clear temp for drawing first frame
                 tempCtx.putImageData(firstFramePatch, frames[0].dims.left, frames[0].dims.top);
                 renderCtx.drawImage(
                     tempCanvas,
                     0, 0, originalImageSize.width, originalImageSize.height,
                     0, 0, targetDimensions.width, targetDimensions.height
                 );


                copyButton.innerText = `Copy code (${targetDimensions.width} x ${targetDimensions.height})`;
                copyButton.disabled = false;
            } catch (error) {
                console.error("Error processing GIF:", error);
                textarea.textContent = "Error processing GIF. Make sure it's a valid GIF file.";
                copyButton.disabled = true;
            }


        } else { // Handle static images (JPG, PNG, etc.)
            currentImageType = 'static';
            gifFramesData = null; // Clear any previous GIF data

            // Create a temporary image element to get original dimensions
            const img = document.createElement("img");
            img.onload = function() {
                originalImageSize = { width: img.width, height: img.height };

                // Calculate target dimensions based on selected mode
                const targetDimensions = calculateTargetDimensions(originalImageSize.width, originalImageSize.height, mode);

                // Use the main canvas to draw the static image scaled
                const ctx = canvas.getContext("2d");
                canvas.width = targetDimensions.width;
                canvas.height = targetDimensions.height;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, targetDimensions.width, targetDimensions.height);

                // Get pixel data from the scaled canvas
                const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

                // Process pixels into bitmap
                const bitmap = processFramePixels(pixelData, targetDimensions.width, targetDimensions.height, palette);

                // Generate MakeCode sprite code
                const makeCode = generateMakeCodeSprite(bitmap, targetDimensions.width, targetDimensions.height);
                textarea.textContent = makeCode;

                copyButton.innerText = `Copy code (${targetDimensions.width} x ${targetDimensions.height})`;
                copyButton.disabled = false;

                // Clean up the temporary image element
                img.remove();
            };
             img.onerror = function() {
                 console.error("Error loading static image.");
                 textarea.textContent = "Error loading image. Make sure it's a valid image file.";
                 copyButton.disabled = true;
                 img.remove();
             };
            // Use the ArrayBuffer to create a Blob URL for the static image
            const blob = new Blob([arrayBuffer], { type: file.type });
            img.src = URL.createObjectURL(blob);
        }
    };

    reader.onerror = function() {
        console.error("Error reading file.");
        textarea.textContent = "Error reading file.";
         copyButton.disabled = true;
    };

    // Read the file as an ArrayBuffer
    reader.readAsArrayBuffer(file);

}

// The run button now just triggers the processing based on the selected file
runButton.addEventListener("click", processImage);

// File input change listener - just enables the convert button and triggers processing
fileInput.addEventListener("change", function() {
    if (this.files.length > 0) {
        runButton.removeAttribute("disabled");
        // Automatically process the image when a file is selected
        processImage();
    } else {
        runButton.disabled = true;
        copyButton.disabled = true;
        textarea.textContent = "";
        canvas.width = 0;
        canvas.height = 0;
        originalImageSize = { width: 0, height: 0 };
        currentImageType = 'static';
        gifFramesData = null;
    }
});

// Radio button change listener - recalculates and re-processes with new size mode
radioButtons.forEach(radioButton => {
    radioButton.addEventListener("change", function sizeOption() {
        mode = this.id;
        // Enable/disable number inputs based on mode
        customSizes.forEach(field => field.disabled = (mode !== "custom"));
        scaleFactor.disabled = (mode !== "scale");

        // If a file is already loaded, re-process with the new size mode
        if (fileInput.files.length > 0) {
            processImage();
        }
    });
});

// Handle input changes in number fields for scale and custom size
// This triggers re-processing when the value changes (e.g., press Enter or blur)
numberInputs.forEach(input => {
    input.addEventListener("change", function() {
        if (fileInput.files.length > 0) {
            processImage();
        }
    });
});


// Form submission listener - prevent default submit and re-process
form.addEventListener("submit", function convertImage(event) {
    event.preventDefault();
     if (fileInput.files.length > 0) {
         processImage(); // Re-process when form is submitted (e.g., pressing Enter in a text field)
     }
});


// Copy button event listener
copyButton.addEventListener("click", function addCodeToClipboard() {
    textarea.select();
    document.execCommand("copy");
    console.log("Code copied to clipboard!");
    copyButton.innerText = "Code copied!";
});

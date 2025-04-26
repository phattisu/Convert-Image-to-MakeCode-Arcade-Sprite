let mode = "full-width";
        let processingMode = "solid";
        let gifFrames = [];
        let currentGifFrame = 0;
        let gifDelayInfo = "";
        let isGif = false;

        const canvas = document.querySelector("canvas");
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
        const solidModeRadio = document.querySelector("input#solidMode");
        const dotMatrixModeRadio = document.querySelector("input#dotMatrixMode");
        const dotMatrixOptions = document.querySelector("div#dotMatrixOptions");
        const dotSizeInput = document.querySelector("input#dotSize");
        const dotSpacingInput = document.querySelector("input#dotSpacing");
        const gifInfoDiv = document.querySelector("div#gifInfo");

        let originalImageSize = {
            width: 0,
            height: 0
        };

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
                        textInput.value = colorInput.value;
                    }
                }
            });
        }

        colorPicks.forEach(colorInput => {
            colorInput.addEventListener("change", function() {
                syncColorToText(colorInput);
            });
        });

        colorTexts.forEach(textInput => {
            textInput.addEventListener("change", function() {
                syncTextToColor(textInput);
            });
        });

        // Processing mode toggle
        solidModeRadio.addEventListener("change", function() {
            processingMode = "solid";
            dotMatrixOptions.style.display = "none";
        });

        dotMatrixModeRadio.addEventListener("change", function() {
            processingMode = "dotMatrix";
            dotMatrixOptions.style.display = "block";
        });

        runButton.addEventListener("click", function running() {
            const img = document.querySelector("img");
            if (isGif && gifFrames.length > 0) {
                processGifFrame(currentGifFrame);
                currentGifFrame = (currentGifFrame + 1) % gifFrames.length;
            } else {
                convert(img);
            }
        });

        fileInput.addEventListener("change", async function whenImageIsUploaded() {
            runButton.removeAttribute("disabled");
            const file = this.files[0];
            const node = document.querySelector("img");

            if (node !== null) {
                node.parentNode.removeChild(node);
            }

            // Check if it's a GIF
            if (file.type === "image/gif") {
                isGif = true;
                await parseGif(file);
                gifInfoDiv.style.display = "block";
                gifInfoDiv.textContent = gifDelayInfo;
            } else {
                isGif = false;
                gifInfoDiv.style.display = "none";
                const img = document.createElement("img");
                img.src = window.URL.createObjectURL(file);
                document.body.appendChild(img);

                img.addEventListener("load", () => {
                    originalImageSize.width = img.width;
                    originalImageSize.height = img.height;
                    mode = "full-width";
                    convert(img);
                });
            }
        });

        async function parseGif(file) {
            const arrayBuffer = await file.arrayBuffer();
            const byteArray = new Uint8Array(arrayBuffer);
            
            // Reset frames
            gifFrames = [];
            currentGifFrame = 0;
            
            // Simple GIF parser (this is a simplified version)
            // Check GIF signature (GIF89a or GIF87a)
            const signature = String.fromCharCode(...byteArray.slice(0, 6));
            if (!signature.startsWith("GIF8")) {
                console.error("Not a valid GIF file");
                return;
            }
            
            // Get logical screen descriptor
            const width = byteArray[6] | (byteArray[7] << 8);
            const height = byteArray[8] | (byteArray[9] << 8);
            const packedFields = byteArray[10];
            const hasGlobalColorTable = (packedFields & 0x80) !== 0;
            const colorResolution = ((packedFields & 0x70) >> 4) + 1;
            const globalColorTableSize = 2 << (packedFields & 0x07);
            
            originalImageSize.width = width;
            originalImageSize.height = height;
            
            let offset = 13;
            if (hasGlobalColorTable) {
                offset += 3 * globalColorTableSize;
            }
            
            let frameCount = 0;
            let totalDelay = 0;
            let minDelay = Infinity;
            let maxDelay = 0;
            
            // Process blocks
            while (offset < byteArray.length) {
                const blockType = byteArray[offset];
                
                if (blockType === 0x2C) { // Image descriptor
                    frameCount++;
                    const imageLeft = byteArray[offset+1] | (byteArray[offset+2] << 8);
                    const imageTop = byteArray[offset+3] | (byteArray[offset+4] << 8);
                    const imageWidth = byteArray[offset+5] | (byteArray[offset+6] << 8);
                    const imageHeight = byteArray[offset+7] | (byteArray[offset+8] << 8);
                    const imagePackedFields = byteArray[offset+9];
                    offset += 10;
                    
                    // Check for local color table
                    const hasLocalColorTable = (imagePackedFields & 0x80) !== 0;
                    if (hasLocalColorTable) {
                        const localColorTableSize = 2 << (imagePackedFields & 0x07);
                        offset += 3 * localColorTableSize;
                    }
                    
                    // Skip image data (LZW compressed)
                    const lzwMinCodeSize = byteArray[offset++];
                    while (true) {
                        const blockSize = byteArray[offset++];
                        if (blockSize === 0) break;
                        offset += blockSize;
                    }
                } 
                else if (blockType === 0x21) { // Extension block
                    const extensionLabel = byteArray[offset+1];
                    
                    if (extensionLabel === 0xF9) { // Graphics Control Extension
                        const blockSize = byteArray[offset+2];
                        const packed = byteArray[offset+3];
                        const delayTime = (byteArray[offset+4] | (byteArray[offset+5] << 8)) * 10; // Convert to ms
                        const transparentIndex = byteArray[offset+6];
                        offset += 4 + blockSize;
                        
                        totalDelay += delayTime;
                        if (delayTime < minDelay) minDelay = delayTime;
                        if (delayTime > maxDelay) maxDelay = delayTime;
                    } 
                    else {
                        const blockSize = byteArray[offset+2];
                        offset += 3 + blockSize;
                        
                        // Skip data sub-blocks
                        while (true) {
                            const subBlockSize = byteArray[offset++];
                            if (subBlockSize === 0) break;
                            offset += subBlockSize;
                        }
                    }
                } 
                else if (blockType === 0x3B) { // Trailer
                    break;
                } 
                else {
                    offset++;
                }
            }
            
            // Create GIF info string
            gifDelayInfo = `GIF detected: ${frameCount} frames | `;
            gifDelayInfo += `Total duration: ${totalDelay}ms | `;
            gifDelayInfo += `Frame delays: min ${minDelay}ms, max ${maxDelay}ms`;
            
            // For demo purposes, we'll create a simple animated GIF preview
            const img = document.createElement("img");
            img.src = window.URL.createObjectURL(file);
            document.body.appendChild(img);
            
            img.addEventListener("load", () => {
                // Create frames from the GIF (simplified - in a real app you'd use a proper GIF decoder)
                for (let i = 0; i < frameCount; i++) {
                    gifFrames.push({
                        delay: minDelay > 0 ? minDelay : 100, // Default to 100ms if no delay found
                        image: img
                    });
                }
                
                // Process first frame
                processGifFrame(0);
            });
        }

        function processGifFrame(frameIndex) {
            if (frameIndex >= gifFrames.length) return;
            
            const frame = gifFrames[frameIndex];
            convert(frame.image);
            
            // Schedule next frame if it's a GIF
            if (isGif && gifFrames.length > 1) {
                setTimeout(() => {
                    processGifFrame((frameIndex + 1) % gifFrames.length);
                }, frame.delay);
            }
        }

        radioButtons.forEach(radioButton => {
            radioButton.addEventListener("change", function sizeOption() {
                mode = this.id;
                const numberInput = this.parentElement.querySelector("input[type='number']");
                customSizes.forEach(field => field.disabled = (mode !== "custom"));
                scaleFactor.disabled = (mode !== "scale");
                scaleFactor.value = 0.1;
                const img = document.querySelector("img");
                if (img) {
                    if (isGif && gifFrames.length > 0) {
                        processGifFrame(currentGifFrame);
                    } else {
                        convert(img);
                    }
                }
            });
        });

        form.addEventListener("submit", function convertImage(event) {
            event.preventDefault();
            const imageDOM = document.querySelector("img");
            if (originalImageSize.width === 0 && originalImageSize.height === 0) {
                originalImageSize.width = imageDOM.width;
                originalImageSize.height = imageDOM.height;
            }
            const img = document.querySelector("img");
            if (isGif && gifFrames.length > 0) {
                processGifFrame(currentGifFrame);
            } else {
                convert(img);
            }
            resetImageSize(img);
        });

        function convert(img) {
            copyButton.innerText = "Copy code";
            
            const arcadeColors = [
                "#00000000", // Transparent
                document.getElementById('col1').value,
                document.getElementById('col2').value,
                document.getElementById('col3').value,
                document.getElementById('col4').value,
                document.getElementById('col5').value,
                document.getElementById('col6').value,
                document.getElementById('col7').value,
                document.getElementById('col8').value,
                document.getElementById('col9').value,
                document.getElementById('col10').value,
                document.getElementById('col11').value,
                document.getElementById('col12').value,
                document.getElementById('col13').value,
                document.getElementById('col14').value,
                document.getElementById('col15').value,
            ].map(function convertFromHexToRGB(color, index) {
                const r = parseInt(color[1] + color[2], 16);
                const g = parseInt(color[3] + color[4], 16);
                const b = parseInt(color[5] + color[6], 16);

                return {
                    color: { r, g, b },
                    index: (index).toString(16)
                }
            });

            function setSpriteDimensions(type) {
                let imageWidth = originalImageSize.width;
                let imageHeight = originalImageSize.height;
                let factor = 1;
                
                if (type === "custom") {
                    let customWidth = document.querySelector(".custom#width").value;
                    let customHeight = document.querySelector(".custom#height").value;

                    if (customWidth && !customHeight) {
                        const factor = customWidth / originalImageSize.width;
                        imageWidth = customWidth;
                        imageHeight *= factor;
                    } else if (!customWidth && customHeight) {
                        const factor = customHeight / originalImageSize.height;
                        imageWidth *= factor;
                        imageHeight = customHeight;
                    } else {
                        imageWidth = customWidth;
                        imageHeight = customHeight;
                    }
                } else if (type === "scale") {
                    const factor = document.querySelector("input#factor").value;
                    imageWidth *= factor;
                    imageHeight *= factor;
                } else if (type === "full-width") {
                    const factor = 160 / imageWidth;
                    imageWidth *= factor;
                    imageHeight *= factor;
                } else if (type === "full-height") {
                    const factor = 120 / imageHeight;
                    imageWidth *= factor;
                    imageHeight *= factor;
                }
                
                img.width = imageWidth;
                img.height = imageHeight;
                copyButton.innerText += ` (${img.width} x ${img.height})`;
            }

            setSpriteDimensions(mode);

            canvas.width = img.width;
            canvas.height = img.height;
            const c = canvas.getContext("2d");
            c.drawImage(img, 0, 0, canvas.width, canvas.height);

            let pixelIndex = 0;
            let makeCodeString = {};
            const data = c.getImageData(0, 0, canvas.width, canvas.height).data;

            // Get dot matrix parameters
            const dotSize = parseInt(dotSizeInput.value) || 1;
            const dotSpacing = parseInt(dotSpacingInput.value) || 1;
            
            for (let i = 0; i < data.length; i += 4) {
                const x = pixelIndex % canvas.width;
                const y = Math.floor(pixelIndex / canvas.width);

                // Skip pixels based on dot spacing in dot matrix mode
                if (processingMode === "dotMatrix" && (x % dotSpacing !== 0 || y % dotSpacing !== 0)) {
                    pixelIndex++;
                    continue;
                }

                const r = data[i + 0];
                const g = data[i + 1];
                const b = data[i + 2];
                const a = data[i + 3];

                const nearest = arcadeColors.sort((prev, curr) => {
                    const rDifference = Math.abs(prev.color.r - r) - Math.abs(curr.color.r - r);
                    const gDifference = Math.abs(prev.color.g - g) - Math.abs(curr.color.g - g);
                    const bDifference = Math.abs(prev.color.b - b) - Math.abs(curr.color.b - b);

                    return rDifference + gDifference + bDifference;
                })[0];

                // Draw preview based on processing mode
                if (processingMode === "dotMatrix") {
                    c.fillStyle = `rgb(${nearest.color.r}, ${nearest.color.g}, ${nearest.color.b})`;
                    c.beginPath();
                    c.arc(x, y, dotSize/2, 0, Math.PI * 2);
                    c.fill();
                } else {
                    c.fillStyle = `rgb(${nearest.color.r}, ${nearest.color.g}, ${nearest.color.b})`;
                    c.fillRect(x, y, 1, 1);
                }

                if (makeCodeString[`row-${y}`] === undefined) {
                    makeCodeString[`row-${y}`] = "";
                } else {
                    if (nearest.index == 0) {
                        makeCodeString[`row-${y}`] += "f";
                    } else {
                        makeCodeString[`row-${y}`] += nearest.index;
                    }
                }

                pixelIndex++;
            }

            // Generate MakeCode output
            let dateString = new Date()
                .toISOString()
                .replaceAll("-", "")
                .replaceAll(":", "")
                .replaceAll(".", "");
            
            let spriteJavaScript = `let mySprite${dateString} = sprites.create(img`
            for (const row in makeCodeString) {
                spriteJavaScript += `\n${makeCodeString[row]}`;
            }
            spriteJavaScript += `\n, SpriteKind.Player)`;

            textarea.textContent = spriteJavaScript;
            copyButton.removeAttribute("disabled");

            copyButton.addEventListener("click", function addCodeToClipboard() {
                textarea.select();
                document.execCommand("copy");
                copyButton.innerText = "Code copied to clipboard!";
                resetImageSize(img);
            });
        }

        function resetImageSize(img) {
            img.width = originalImageSize.width;
            img.height = originalImageSize.height;
            }

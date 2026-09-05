const searchForm =
    document.getElementById(
        "medicine-search-form"
    );


const searchInput =
    document.getElementById(
        "medicine-search"
    );


const container =
    document.querySelector(
        ".medicine-card-grid"
    );


// --------------------------------
// Search Medicines
// --------------------------------

if (searchForm) {

    searchForm.addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const searchValue =
                searchInput.value.trim();


            const searchType =
                document.querySelector(
                    'input[name="search-type"]:checked'
                )?.value || "active";


            if (!searchValue) {
                return;
            }


            try {

                const response =
                    await fetch(
                        "/api/medicines",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                name: searchValue,
                                search_type: searchType
                            })
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "Search failed"
                    );

                }


                const html =
                    await response.text();


                if (container) {

                    container.innerHTML =
                        html;

                }


            } catch (error) {

                console.error(
                    "Search error:",
                    error
                );


                if (container) {

                    container.innerHTML = `
                        <p>
                            Unable to search
                            for medicines.
                        </p>
                    `;

                }

            }

        }
    );

}


// --------------------------------
// Lens Scanner Module
// --------------------------------

let lensStream = null;

const openLensBtn = document.getElementById('openLensBtn');
const closeLensBtn = document.getElementById('closeLensBtn');
const captureLensBtn = document.getElementById('captureLensBtn');
const lensModal = document.getElementById('lensModal');
const lensVideo = document.getElementById('lensVideo');
const lensCanvas = document.getElementById('lensCanvas');

// Filter & isolate medicine name from OCR text
function filterMedicineName(rawText) {
    if (!rawText) return "";

    const lines = rawText.split("\n");

    const fillerWords = [
        "mg", "mcg", "gm", "ml", "tablet", "tablets", "capsule", "capsules",
        "syrup", "injection", "batch", "exp", "mfd", "mfg", "date", "price",
        "mrp", "rs", "dose", "dosage", "keep", "out", "reach", "children",
        "store", "cool", "dry", "place", "prescribed", "schedule", "warning", "caution",
        "for", "external", "use", "only", "lab", "ltd", "pvt", "pharma", "manufactured", "by"
    ];

    let candidates = [];

    for (let line of lines) {
        let cleanedLine = line.trim();

        if (cleanedLine.length < 3 || /^\d+$/.test(cleanedLine) || /\d{2}[\/\.-]\d{2}/.test(cleanedLine)) {
            continue;
        }

        cleanedLine = cleanedLine.replace(/\b\d+(\.\d+)?\s*(mg|mcg|g|gm|ml)\b/gi, "");
        cleanedLine = cleanedLine.replace(/\b\d+%\b/g, "").replace(/\b\d+\b/g, "");
        cleanedLine = cleanedLine.replace(/[^a-zA-Z\s]/g, " ").replace(/\s+/g, " ").trim();

        const words = cleanedLine.split(" ").filter(word => {
            return word.length >= 3 && !fillerWords.includes(word.toLowerCase());
        });

        if (words.length > 0) {
            candidates.push(words.join(" "));
        }
    }

    return candidates.length > 0 ? candidates[0] : "";
}

if (openLensBtn) {

    // 1. Open Camera
    openLensBtn.addEventListener('click', async () => {
        try {
            lensStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'environment',
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });
            if (lensVideo) {
                lensVideo.srcObject = lensStream;
            }
            if (lensModal) {
                lensModal.style.display = 'flex';
            }
        } catch (err) {
            alert('Unable to access camera. Please allow camera permissions.');
            console.error(err);
        }
    });

    // 2. Close Camera
    function closeLens() {
        if (lensStream) {
            lensStream.getTracks().forEach(track => track.stop());
            lensStream = null;
        }
        if (lensModal) {
            lensModal.style.display = 'none';
        }
    }

    if (closeLensBtn) {
        closeLensBtn.addEventListener('click', closeLens);
    }

    // 3. Capture Frame & Extract Text (Fills input field ONLY; does NOT submit automatically)
    if (captureLensBtn) {
        captureLensBtn.addEventListener('click', async () => {
            if (!lensVideo || !lensVideo.videoWidth) return;

            captureLensBtn.innerText = 'Scanning...';
            captureLensBtn.disabled = true;

            const videoW = lensVideo.videoWidth;
            const videoH = lensVideo.videoHeight;

            const cropX = Math.floor(videoW * 0.10);
            const cropY = Math.floor(videoH * 0.10);
            const cropW = Math.floor(videoW * 0.80);
            const cropH = Math.floor(videoH * 0.80);

            lensCanvas.width = cropW;
            lensCanvas.height = cropH;
            const ctx = lensCanvas.getContext('2d');

            ctx.drawImage(lensVideo, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

            try {
                const imageData = lensCanvas.toDataURL('image/jpeg');

                // Perform Tesseract OCR scan
                const result = await Tesseract.recognize(imageData, 'eng');
                const rawText = result.data.text;
                const extractedName = filterMedicineName(rawText);

                if (extractedName) {
                    if (searchInput) {
                        searchInput.value = extractedName;
                    }
                    
                    // Switch search mode to "Medicine Name" automatically when scanning
                    const nameRadio = document.querySelector('input[name="search-type"][value="name"]');
                    if (nameRadio) {
                        nameRadio.checked = true;
                    }

                    closeLens();
                } else {
                    alert('Could not cleanly read medicine name. Align the packaging inside the frame and try again.');
                }
            } catch (err) {
                console.error('OCR Error:', err);
                alert('Error scanning text.');
            } finally {
                captureLensBtn.innerText = 'Scan Text';
                captureLensBtn.disabled = false;
            }
        });
    }
}
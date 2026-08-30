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
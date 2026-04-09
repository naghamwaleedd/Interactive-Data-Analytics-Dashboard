
const colorMap = {
    "Good": '#39d98a',
    "Bad": '#ff6b6b',
    "Neutral": '#aab2d5'
};


const noDataF = {
    id: "noData",
    afterDraw(chart) {
        const data = chart.data.datasets[0].data;
        if (!data || !data.length || data.every(v => !v || Number(v) === 0)) {
            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.font = "bold 18px Inter, sans-serif";
            ctx.fillStyle = "#fff";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(
                "No Data Found",
                (chartArea.left + chartArea.right) / 2,
                (chartArea.top + chartArea.bottom) / 2
            );
            ctx.restore();
        }
    }
};

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("year").textContent = new Date().getFullYear();

    //automatic date and time
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("dateFrom").value = today;
    document.getElementById("dateTo").value = today;
    document.getElementById("timeFrom").value = "00:00";
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const currentTime = `${hours}:${minutes}`;

    document.getElementById("timeFrom").value = currentTime;
    document.getElementById("timeTo").value = "23:59";


    const ctx1 = document.getElementById("salesChart").getContext("2d");
    const ctx2 = document.getElementById("ordersChart").getContext("2d");

    const salesChart = new Chart(ctx1, {
        type: "pie",
        data: {
            labels: [],
            datasets: [{
                label: "Sentiment",
                data: [],
                backgroundColor: [],
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "right",
                    labels: {
                        font: {
                            size: 14,
                            weight: "600"
                        },
                        color: "#aab2d5",
                        usePointStyle: true,
                        pointStyle: "circle",
                        padding: 20,
                        generateLabels: function (chart) {
                            const data = chart.data;
                            if (data.labels.length && data.datasets.length) {
                                return data.labels.map(function (label, i) {
                                    const value = data.datasets[0].data[i];
                                    return {
                                        text: `${label}: ${value}%`,
                                        fillStyle: data.datasets[0].backgroundColor[i],
                                        fontColor: "#aab2d5",
                                        hidden: isNaN(value) || value === 0,
                                        index: i
                                    };
                                });
                            }
                            return [];
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.label}: ${ctx.formattedValue}%`
                    }
                }
            }
        },
        plugins: [noDataF]
    });

    const ordersChart = new Chart(ctx2, {
        type: "pie",
        data: {
            labels: [],
            datasets: [{
                label: "Keywords",
                data: [],
                backgroundColor: [],
                borderColor: "#fff",
                borderWidth: 2,
                hoverOffset: 15
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false } 
            }
        },
        plugins: [{
            id: "externalLegend",
            afterUpdate: chart => renderExternalLegend(chart)
        }]
    });
    function renderExternalLegend(chart) {
        const container = document.getElementById("legend-container");
        if (!container) return;

        container.innerHTML = ""; 

        const labels = chart.data.labels || [];
        const values = chart.data.datasets[0]?.data || [];
        const colors = chart.data.datasets[0]?.backgroundColor || [];

        labels.forEach((label, i) => {
            const item = document.createElement("div");
            item.style.display = "inline-flex";
            item.style.alignItems = "center";
            item.style.gap = "6px";
            item.style.marginRight = "12px";
            item.style.padding = "6px 10px";
            item.style.borderRadius = "6px";
            item.style.whiteSpace = "nowrap";
            item.style.cursor = "pointer";
            item.style.background = "rgba(255,255,255,0.05)";

            // dot
            const dot = document.createElement("span");
            dot.style.width = "14px";
            dot.style.height = "14px";
            dot.style.borderRadius = "50%";
            dot.style.background = colors[i] || "#ccc";

            // label
            const text = document.createElement("span");
            text.style.color = "#aab2d5";
            text.style.fontSize = "13px";
            text.style.fontWeight = "600";
            text.textContent = `${label} (${values[i]})`;

            item.appendChild(dot);
            item.appendChild(text);

            // Toggle visibility on click
            item.addEventListener("click", () => {
                chart.toggleDataVisibility(i);
                chart.update();
            });

            container.appendChild(item);
        });
    }


   
    function loadSentimentData(from, to) {
        let url = `https://localhost:7032/api/Sentiment/GetSentiment?from=${from}&to=${to}`;

        $.ajax({
            url: url,
            type: 'GET',
            success: function (response) {
                if (response.returncode === 200) {
                    let labels = [];
                    let values = [];
                    let colors = [];

                    response.data.forEach(item => {
                        labels.push(item.sentimentkey);
                        values.push(item.sentimentperc);

                        // Force correct colors
                        if (item.sentimentkey === "Good") colors.push(colorMap["Good"]);
                        else if (item.sentimentkey === "Bad") colors.push(colorMap["Bad"]);
                        else if (item.sentimentkey === "Neutral") colors.push(colorMap["Neutral"]);
                        else colors.push("#bdc3c7");
                    });

                    salesChart.data.labels = labels;
                    salesChart.data.datasets[0].data = values;
                    salesChart.data.datasets[0].backgroundColor = colors;
                    salesChart.update();

                    // Update range labels
                    const fromDate = new Date(from);
                    const toDate = new Date(to);
                    const opts = { month: 'short', day: '2-digit', year: 'numeric' };
                    const f = fromDate.toLocaleDateString(undefined, opts);
                    const t = toDate.toLocaleDateString(undefined, opts);

                    document.getElementById("rangeLabel1").textContent = `${f} → ${t}`;
                    document.getElementById("rangeLabel2").textContent = `${f} → ${t}`;
                } else {
                    console.error("Sentiment API Error: ", response.returnDescription);
                    alert("Error: " + response.returnDescription);
                }
            },
            error: function (xhr, status, error) {
                console.error("Sentiment API Request Failed: ", status, error);
                salesChart.data.labels = [];
                salesChart.data.datasets[0].data = [];
                salesChart.update();
            }
        });
    }
  
    function formatDateTimeWithSeconds(dateStr, timeStr) {
        const timeWithSeconds = timeStr.includes(":") && timeStr.split(":").length === 2
            ? timeStr + ":01"   // add ":01" if only HH:mm
            : timeStr;          // keep as-is if seconds are already present
        return `${dateStr}T${timeWithSeconds}`;
}
function generateContrastingColors(count) {
    const colors = [];
    for (let i = 0; i < count; i++) {
        const hue = (i * 360 / count) % 360;
        colors.push(`hsl(${hue}, 90%, 50%)`); 
    }
    return colors;
}
   
  

    function loadKeywordData(from, to) {
        const url = `https://localhost:7147/api/Keyword?from=${from}&to=${to}`;

        $.ajax({
            url: url,
            type: 'GET',
            success: function (response) {
                let keywords = Array.isArray(response) ? response : response.data || [];

                if (keywords.length > 0) {
                    const labels = keywords.map(k => k.keyword);
                    const values = keywords.map(k => k.count);
                    const colors = generateContrastingColors(labels.length);

                    ordersChart.data.labels = labels;
                    ordersChart.data.datasets[0].data = values;
                    ordersChart.data.datasets[0].backgroundColor = colors;
                    ordersChart.update(); 
                } else {
                    ordersChart.data.labels = [];
                    ordersChart.data.datasets[0].data = [];
                    ordersChart.update();
                }
            },
            error: function (xhr, status, error) {
                console.error("Keyword API Request Failed:", status, error);
                ordersChart.data.labels = [];
                ordersChart.data.datasets[0].data = [];
                ordersChart.update();
            }
        });
    }

    document.getElementById("applyBtn").addEventListener("click", function () {
        const dateFrom = document.getElementById("dateFrom").value;
        const timeFrom = document.getElementById("timeFrom").value || "00:00";
        const dateTo = document.getElementById("dateTo").value;
        const timeTo = document.getElementById("timeTo").value || "23:59";

        if (dateFrom && dateTo) {
            const from = formatDateTimeWithSeconds(dateFrom, timeFrom);
            const to = formatDateTimeWithSeconds(dateTo, timeTo);

            loadSentimentData(from, to);
            loadKeywordData(from, to);
        } else {
            alert("Please select both dates.");
        }
    });

   
    const initialFrom = formatDateTimeWithSeconds(
        document.getElementById("dateFrom").value,
        document.getElementById("timeFrom").value || "00:00"
    );
    const initialTo = formatDateTimeWithSeconds(
        document.getElementById("dateTo").value,
        document.getElementById("timeTo").value || "23:59"
    );
    loadSentimentData(initialFrom, initialTo);
    loadKeywordData(initialFrom, initialTo);
})
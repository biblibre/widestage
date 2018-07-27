/* global c3:false */

app.service('c3Charts', function () {
    this.rebuildChart = function (report) {
        var theValues = [];
        var theStackValues = {};
        var theTypes = {};
        var theNames = {};
        var theGroups = [];
        var theData = [];

        var query = report.query;
        var chart = report.properties.chart;
        var queryID = report.query.id;

        var axisField = '';
        if (chart.dataAxis) { axisField = chart.dataAxis.id; }
        // var axisIsInQuery = false;

        var stackField = '';
        if (chart.stackDimension) { stackField = chart.stackDimension.id; }
        // var stackIsInQuery = false;

        chart.noUnicityWarning = false;
        // Indicates that for a single (axisField * stackField) value there are multiple entries
        // This causes some of the charts to display weird or misleading results

        if (!query.data) {
            noty({text: 'no data to display', timeout: 2000, type: 'warning'});
            return;
        }

        for (const dtc of chart.dataColumns) {
            theValues.push(dtc.id);
            theTypes[dtc.id] = dtc.type || 'bar';
            theNames[dtc.id] = dtc.elementLabel;
        }

        if (stackField && chart.type === 'line') {
            /* A second field has been entered as a dimension.
            * The chart must in this case be displayed as stacked bars.
            * Due to the way c3 functions, the way to do this is by ctreating a data column for each possible value
            * of the second dimension.
            * the name of the data column will be [name of ykey] + '-' + [ field value ]
            */

            var mapOnAxis = {};

            for (const valueKey of theValues) {
                theStackValues[valueKey] = [];
            }

            var newData = [];

            query.data.map(function (item) {
                if (!item[axisField]) {
                    return;
                }

                const x = item[axisField];

                if (!mapOnAxis[x]) {
                    mapOnAxis[x] = [];
                }

                mapOnAxis[x].push(item);
            });

            const reducer = function (accumulator, oldItem) {
                if (!oldItem[stackField]) {
                    return accumulator;
                }

                var currentItem = accumulator;

                for (const valueKey of theValues) {
                    if (oldItem[valueKey] !== undefined) {
                        const combinedKey = String(oldItem[stackField]) + '-' + valueKey;

                        if (theStackValues[valueKey].indexOf(combinedKey) < 0) {
                            theStackValues[valueKey].push(combinedKey);

                            theTypes[combinedKey] = theTypes[valueKey];

                            if (theValues.length === 1) {
                                theNames[combinedKey] = String(oldItem[stackField]);
                            } else {
                                theNames[combinedKey] = theNames[valueKey] + ' : ' + String(oldItem[stackField]);
                            }
                        }

                        if (currentItem[combinedKey]) {
                            newData.push(currentItem);
                            var newItem = {};
                            newItem[axisField] = currentItem[axisField];
                            chart.noUnicityWarning = true;
                            currentItem = newItem;
                        }

                        currentItem[combinedKey] = oldItem[valueKey];
                    }
                }

                return currentItem;
            };

            for (const x in mapOnAxis) {
                const newItem = {};
                newItem[axisField] = x;
                newData.push(mapOnAxis[x].reduce(reducer, newItem));
            }

            theValues = [];
            theGroups = [];
            for (const valueKey in theStackValues) {
                theGroups.push(theStackValues[valueKey]);
                theValues = theValues.concat(theStackValues[valueKey]);
            }

            theData = newData;

            chart.stackKeys = theStackValues;
        } else {
            theData = query.data;
            theGroups = undefined;
        }

        var theChartCode = '#CHART_' + queryID;

        if (!chart.height) { chart.height = 300; }

        let canvasArgs;

        switch (chart.type) {
        case 'pie':
        case 'donut':
            var theColumns = [];
            if (axisField && theValues) {
                for (const i in query.data) {
                    const groupField = query.data[i][axisField];
                    const valueField = query.data[i][theValues[0]];
                    theColumns.push([groupField, valueField]);
                }
            }

            canvasArgs = {
                bindto: theChartCode,
                data: {
                    columns: theColumns,
                    type: chart.type
                },

                size: {
                    height: chart.height
                }
            };
            break;

        case 'gauge':
            canvasArgs = {
                bindto: theChartCode,
                data: {
                    columns: [theValues[0], query.data[0][theValues[0]]],
                    type: chart.type
                },
                gauge: {
                    //        label: {
                    //            format: function(value, ratio) {
                    //                return value;
                    //            },
                    //            show: false // to turn off the min/max labels.
                    //        },
                    //    min: 0, // 0 is default, //can handle negative min e.g. vacuum / voltage / current flow / rate of change
                    //    max: (query.data[0][theValues[0]]*2), // 100 is default
                    //    units: '' //' %',
                    //    width: 39 // for adjusting arc thickness
                },

                size: {
                    height: chart.height
                }
            };
            break;

        case 'line' :
            canvasArgs = {
                bindto: theChartCode,
                data: {
                    json: theData,
                    keys: {
                        x: axisField,
                        value: theValues
                    },
                    types: theTypes,
                    names: theNames,
                    groups: theGroups
                },
                axis: {
                    x: {
                        type: 'category',
                        tick: {
                            culling: {
                                max: 20
                            },
                            multiline: false,
                            rotate: 45
                        }
                    }
                },
                size: {
                    height: chart.height
                }
            };

            break;
        }

        chart.chartCanvas = c3.generate(canvasArgs);
    };

    this.deleteChartColumn = function (chart, column) {
        var index = chart.dataColumns.indexOf(column);
        if (index > -1) {
            chart.dataColumns.splice(index, 1);

            this.rebuildChart(chart);
        } else {
            // seems that this chart has a query that changed and the column cant be found in

        }
    };

    this.changeChartColumnType = function (chart, column) {
        if (chart.stacked) {
            for (const key of chart.stackKeys[column.id]) {
                chart.chartCanvas.transform(column.type, key);
            }
        } else {
            chart.chartCanvas.transform(column.type, column.id);
        }
    };

    this.getChartHTML = function (report, mode) {
        var html = '';

        const theChartID = report.query.id;

        if (mode === 'edit') {
            html = '<c3chart page-block ndType="c3Chart" bindto-id="CHART_' + theChartID + '" id="CHART_' + theChartID + '" >';
        } else {
            html = '<c3chart bindto-id="CHART_' + theChartID + '" id="CHART_' + theChartID + '" >';
        }
        html = html + '</c3chart>';
        return html;
    };

    this.chartColumnTypeOptions = [
        {
            id: 'spline',
            name: 'Spline',
            image: 'images/spline.png'
        },
        {
            id: 'bar',
            name: 'Bar',
            icon: 'fa fa-bar-chart'
        },
        {
            id: 'area',
            name: 'Area',
            icon: 'fa fa-area-chart'
        },
        {
            id: 'line',
            name: 'Line',
            icon: 'fa fa-line-chart'
        },
        {
            id: 'area-spline',
            name: 'Area spline',
            image: 'images/area-spline.png'
        },
        {
            id: 'scatter',
            name: 'Scatter',
            image: 'images/scatter.png'
        }
    ];

    this.chartSectorTypeOptions = [
        {
            id: 'pie',
            name: 'Pie',
            image: 'images/pie.png'
        },
        {
            id: 'donut',
            name: 'Donut',
            image: 'images/donut.png'
        }
    ];
});

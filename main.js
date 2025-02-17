let mode = "full-width"
// https://makecode.com/_EvPP98M4pYEC

/**
 * To do:
 * 
 * 1. Implement "fit", "fill", "custom"
 * 2. Black and white mode
 * 3. Other cool effects
 * 4. Shuffle colors
 */

const canvas = document.querySelector("canvas")
const copyButton = document.querySelector("button#copy")
const runButton = document.querySelector("button#run")
const customSizes = document.querySelectorAll("input[type='number'].custom")
const fileInput = document.querySelector("input#myFile")
const form = document.querySelector("form")
const numberInputs = document.querySelectorAll("input[type='number']")
const radioButtons = document.querySelectorAll("input[type='radio']")
const colorPicks = document.querySelectorAll("input.colorpicker[type='color']")
const colorTexts = document.querySelectorAll("input.colortext[type='text']")
const scaleFactor = document.querySelector("input[type='number']#factor")
const textarea = document.querySelector("textarea")

let originalImageSize = {
	width: 0,
	height: 0
}

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

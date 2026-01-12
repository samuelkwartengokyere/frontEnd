const counterEl = document.querySelectorAll('.counter')

counterEl.forEach(counterEl=>{
    counterEl.innerText = '0'

    updateCounter()

    function updateCounter(){
        let currentNum = +counterEl.innerText;

        const dataCeil = counterEl.getAttribute('data-ceil')

        const increament = dataCeil / 200

        currentNum = currentNum + increament


        if(currentNum < dataCeil){
            counterEl.innerText = Math.ceil(currentNum)
            setTimeout(updateCounter, 20)
        }else{
            counterEl.innerText = dataCeil
        }

    }
})
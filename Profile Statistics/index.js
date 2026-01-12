const counterEl = document.querySelectorAll('.counter')


counterEl.forEach(counterEl=>{
    counterEl.innerText = '0'

    increaseCounter()

    function increaseCounter(){
        let currentNum = +counterEl.innerText 

        const dataCeil = counterEl.getAttribute('data-ceil')

        const increament = dataCeil / 150   

        currentNum = currentNum + increament

       


        if(currentNum < dataCeil){
             counterEl.innerText = Math.ceil(currentNum)
             setTimeout(increaseCounter, 10)
        }else{
            counterEl.innerText = dataCeil
        }

         
    }
})
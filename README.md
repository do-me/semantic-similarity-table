# Semantic Similarity Table
Drag and drop your Excel or CSV file with a text column for batch calculating semantic similarity for your queries.

![](data/sst.svg)

App here: https://do-me.github.io/semantic-similarity-table/

## Short explanation 

For every text cell, the text is chunked and the chunks inferenced with model2vec. The resulting embeddings are compared against the query embeddings with cosine distance. Based on this distance, the mean and max similarity as well as the chunk with the highest similarity are calculated. Additionally, the number of chunks per row and the embeddings themselves can be added to the table.

- Input: a csv or xlsx/xls with at least 1 column with any kind of text of any length
- Output: the same table in the same format as the input (csv or xlsx/xls) with added columns

Feel free to ask questions in the issues or discussions!

![image](https://github.com/user-attachments/assets/41082450-7170-4cb0-84f5-2f15fc90fc4a)

## To Do 
- add new potion models add allow as user settings
